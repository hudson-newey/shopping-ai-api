const { Configuration, OpenAIApi } = require("openai");
const express = require("express");
const cors = require("cors");
const redis = require("redis");
const morgan = require("morgan");
require("dotenv").config();

interface ChatMessage {
  role: string;
  content: string;
}

interface Session {
  id: string;
  history: ChatMessage[];
}

interface RequestBody {
  history: ChatMessage[];
}

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
expressApp.use(
  express.urlencoded({
    extended: true,
  })
);
expressApp.use(express.json());
expressApp.use(morgan("dev"));

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

// the root directory should always redirect back to the client site
// this is to add another client access point and to help users navigate to the correct site
// we may also be able to use this endpoint as a redirect/shortened URL in the future
expressApp.get("/", (_req, res) => {
  res.redirect(process.env.CLIENT_ENDPOINT);
});

expressApp.post("/api/", async (req, res) => {
  const { query } = req;

  const userQuery = query?.q;

  const requestBody: RequestBody = req.body;
  let userHistory = requestBody?.history;

  if (!userHistory) {
    userHistory = [];
  }

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
          ...userHistory,
          { role: "user", content: promptPrepend + userQuery + promptPrepend },
        ],
      });

      const response = chatCompletion.data.choices[0].message;

      // send back the response to the user
      res.send(response);

      // cache the response
      const responseContentToCache = response?.content;

      if (responseContentToCache) {
        redisClient.set(toDbKey(userQuery), responseContentToCache);
      }
    }

    // for new line character
    console.log();
  }
});

expressApp.listen(port, async () => {
  await redisClient.connect();
  console.log(`api listening on port ${port}`);
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
