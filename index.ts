// for functionality
const { Configuration, OpenAIApi } = require("openai");
const express = require("express");
const redis = require("redis");
const cors = require("cors");

// for logging
const morgan = require("morgan");

// for security
const Ajv = require("ajv");
const helmet = require("helmet");
const validator = require('validator');
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

const ajv = new Ajv();

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

// this is used to increase security
expressApp.use(helmet());
// this is used to log all incoming requests
expressApp.use(morgan("dev"));
// this is used for the development environment
expressApp.use(
  cors({
    origin: "http://localhost:4200",
  })
);

function toDbKey(message: string): string {
  const sanitizedMessage = validator.whitelist(
    message,
    ["a-z", "A-Z", "0-9"]
  );
  
  // reducing the message to its most descriptive components increases the chance of a cache hit
  return sanitizedMessage.toLowerCase()
}

function sanitizeUserInput(data: object): boolean {
  const objectSchema = {
    type: "object",
    properties: {
      role: {type: "string"},
      content: {type: "string"},
    },
    required: ["role", "content"],
    additionalProperties: false,
  };
  
  const schema = {
    type: "array",
    items: objectSchema,
  };
  
  const validate = ajv.compile(schema);
  return !!validate(data);
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
    // while this route does exist, if the user isn't using the official client, we should gas light them into thinking that the /api route doesn't exist
    res.statusCode = 404;
    res.end();
    return;
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

      if (!sanitizeUserInput(userHistory)) {
        console.error("user tried invalid user history input");
        // due to hacking attempts, we do not want to send any feedback to the client if its a malformed request
        res.statusCode = 400;
        res.end();
        return;
      }

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

// // Middleware to handle undefined routes
// expressApp.use((_req, res, _next) => {
//   // due to hacking attempts, we do not want to send any feedback to the client if its a malformed request
//   res.statusCode = 404;
//   res.end();
// });

expressApp.listen(port, async () => {
  await redisClient.connect();
  console.log(`api listening on port ${port}`);
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
