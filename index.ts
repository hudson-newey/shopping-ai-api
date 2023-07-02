const { Configuration, OpenAIApi } = require("openai");
const express = require("express");
const cors = require("cors");
const redis = require("redis");
require("dotenv").config();

interface ChatMessage {
  role: string;
  content: string;
}

interface Session {
  id: string;
  history: ChatMessage[];
}

let sessions: Session[] = [];
const anonymousSessionId = "-1";

const redisClient = redis.createClient();
const expressApp = express();
const port = 8080;

const promptPrepend = "what items from amazon would i need for ";
const promptAppend =
  ". list the items in numbered bullet points using the \\nx: format";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

expressApp.use(cors());

function toDbKey(message: string): string {
  // reducing the message to its most descriptive components increases the chance of a cache hit
  message = message
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]|_/g, "")
    .replace(/\s+/g, " ")
    .replace(" ", "-");

  return message;
}

function getSessionHistory(requestedSession: string): ChatMessage[] {
  // is an anonymous requestedSession
  if (requestedSession === "-1") {
    return [];
  }

  sessions.forEach((session: Session) => {
    if (session.id === requestedSession) {
      return session.history;
    }
  });

  console.error(`Could not find session: ${requestedSession}`);
  return [];
}

function removeSession(sessionId: string) {
  sessions = sessions.filter((session: Session) => session.id !== sessionId);
}

function updateSession(role: string, content: string, sessionId: string) {
  const currentSessionHistory = getSessionHistory(sessionId);

  const newSessionHistory: Session = {
    id: sessionId,
    history: [
      ...currentSessionHistory,
      {
        role,
        content,
      },
    ],
  };

  removeSession(sessionId);

  sessions.push(newSessionHistory);
}

function sessionIdExists(sessionId: string): boolean {
  sessions.forEach((session: Session) => {
    if (session.id === sessionId) {
      return true;
    }
  });

  return false;
}

function getNewSession(): string {
  // get a random 36 character string
  let newSessionId = Math.random().toString(36).substring(2, 15);

  while (sessionIdExists(newSessionId)) {
    newSessionId = Math.random().toString(36).substring(2, 15);
  }

  sessions.push({
    id: newSessionId,
    history: [],
  });

  return newSessionId;
}

// the root directory should always redirect back to the client site
// this is to add another client access point and to help users navigate to the correct site
// we may also be able to use this endpoint as a redirect/shortened URL in the future
expressApp.get("/", (_req, res) => {
  res.redirect(process.env.CLIENT_ENDPOINT);
});

expressApp.get("/session/", async (req, res) => {
  const { query } = req;
  const session = query?.v;

  if (!session) {
    res.send("Error 101: Bad format");
    return;
  }

  const sessionHistory = {
    session,
    content: getSessionHistory(session),
  };

  res.send(sessionHistory);
});

expressApp.get("/session/clear", async (req, res) => {
  const { query } = req;
  const sessionId = query?.v;

  if (!sessionId) {
    res.send("Error 101: Bad format");
    return;
  }

  sessions = sessions.filter((session: Session) => session.id !== sessionId);
});

expressApp.get("/session/new", async (_req, res) => {
  const newSessionId = getNewSession();

  res.send({
    content: newSessionId,
  });
});

expressApp.get("/api/", async (req, res) => {
  const { query } = req;

  const userQuery = query?.q;

  // if the session is -1, it is an anonymous session
  const session = query?.v ?? anonymousSessionId;

  if (!userQuery) {
    res.send("Error 101: Bad format");
  } else {
    console.log(`request: ${query.q}`);

    // check if the response has been cached
    const hasCachedResponse: boolean = await redisClient.exists(
      toDbKey(userQuery)
    );

    // if the response has not been cached, we fetch a new response and cache it
    if (hasCachedResponse) {
      console.debug("using cached response");

      const cachedResponse = await redisClient.get(toDbKey(userQuery));

      if (session !== anonymousSessionId) {
        updateSession("user", userQuery, session);
        updateSession("assistant", cachedResponse, session);  
      }

      res.send({
        role: "cache",
        content: cachedResponse,
      });
    } else {
      console.debug("fetching new response");
      // fetch a new response from the api
      const chatCompletion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          ...getSessionHistory(session),
          { role: "user", content: promptPrepend + userQuery + promptPrepend },
        ],
      });

      const response = chatCompletion.data.choices[0].message;

      // send back the response to the user
      res.send(response);

      // cache the response
      const responseContentToCache = response?.content;

      if (session !== anonymousSessionId) {
        updateSession("user", userQuery, session);
        updateSession("assistant", responseContentToCache, session);  
      }

      if (responseContentToCache) {
        redisClient.set(toDbKey(userQuery), responseContentToCache);
      }
    }

    console.log(sessions);
  }
});

expressApp.listen(port, async () => {
  await redisClient.connect();
  console.log(`api listening on port ${port}`);
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
