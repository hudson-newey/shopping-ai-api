import express, { Request, Response, NextFunction } from "express";
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionResponseMessage,
  Configuration,
  OpenAIApi,
} from "openai";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import validator from "validator";

// for security
const Ajv = require("ajv");
require("dotenv").config();
const redis = require("redis");

const isDevelopment: boolean = process.env.DEVELOPMENT === "true";

interface RequestBody {
  history?: ChatCompletionRequestMessage[];
  q?: string;
}

const ajv = new Ajv();

const redisClient = isRedisEnabled() ? redis.createClient() : undefined;
const expressApp = express();
const port = 8080;

const promptPrepend = "what items from amazon would i need for ";
const promptAppend =
  ". list the items in numbered bullet points using the \\nx: format (new line number: item name). Give a bit of an explanation for each item";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openAiService = new OpenAIApi(configuration);

// this is used to increase security
expressApp.use(helmet());
// this is used to log all incoming requests
expressApp.use(morgan("dev"));
// this is used for the development environment
expressApp.use(
  cors({
    origin: process.env.CLIENT_ENDPOINT,
  })
);

function toDbKey(message: string): string {
  const sanitizedMessage = validator.whitelist(message, "a-zA-Z0-9");

  // reducing the message to its most descriptive components increases the chance of a cache hit
  return sanitizedMessage.toLowerCase();
}

function sanitizeUserInput(data: object): boolean {
  const objectSchema = {
    type: "object",
    properties: {
      role: { type: "string" },
      content: { type: "string" },
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

function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED === "true";
}

// the root directory should always redirect back to the client site
// this is to add another client access point and to help users navigate to the correct site
// we may also be able to use this endpoint as a redirect/shortened URL in the future
// expressApp.get("/", (_req, res) => {
//   res.redirect(process.env.CLIENT_ENDPOINT);
// });

// we hard code the robots.txt so the api can be isolated from the file system
const robotsTxt: string = `User-agent: *\nDisallow: /`;
expressApp.get("/robots.txt", (_req, res) => {
  res.setHeader("content-type", "text/plain");
  res.send(robotsTxt);
});

expressApp.post("/api/", async (req, res) => {
  const { query } = req;
  const requestBody: RequestBody = req.body;

  let userQuery: string | undefined = query?.q?.toString();

  if (userQuery === undefined) {
    if (requestBody?.q) {
      userQuery = requestBody.q;
    }
  }

  let userHistory: ChatCompletionRequestMessage[] | undefined =
    requestBody?.history;

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
    const hasCachedResponse: boolean = isRedisEnabled()
      ? (await redisClient.exists(toDbKey(userQuery))) === 1
      : false;

    // if the response has not been cached, we fetch a new response and cache it
    if (hasCachedResponse) {
      console.debug("using cached response");

      const cachedResponse = await redisClient.get(toDbKey(userQuery));

      res.send({
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
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

      console.log(userHistory);

      if (!isDevelopment) {
        // fetch a new response from the api

        const chatCompletion = await openAiService.createChatCompletion({
          model: process.env.OPENAI_MODEL as string,
          messages: [
            ...userHistory,
            {
              role: ChatCompletionRequestMessageRoleEnum.User,
              content: promptPrepend + userQuery + promptAppend,
            },
          ],
        });

        const response = chatCompletion.data.choices[0].message;

        // send back the response to the user
        res.send(response);

        // cache the response
        const responseContentToCache = response?.content;

        if (responseContentToCache) {
          if (isRedisEnabled()) {
            redisClient.set(toDbKey(userQuery), responseContentToCache);
          }
        }
      } else {
        // use fake response for development

        const fakeResponse: ChatCompletionResponseMessage = {
          role: "assistant",
          content: "fake API response (due to server development mode)",
        };

        res.send(fakeResponse);
      }
    }

    // for new line character
    console.log();
  }
});

// custom 404
expressApp.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    // Exclude OPTION requests from custom 404 page
    next();
  }

  console.error(
    "request tried to access a non-existent endpoint",
    req.url,
    req.socket.remoteAddress
  );
  res.statusCode = 404;
  res.end();
});

// custom error handler
expressApp.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.stack);
    res.statusCode = 500;
    res.end();
  }
);

expressApp.listen(port, async () => {
  if (isRedisEnabled()) {
    await redisClient.connect();
  }

  console.log(`api listening on port ${port}`);
});

if (isRedisEnabled()) {
  redisClient.on("error", (err: Error) =>
    console.log("Redis Client Error", err)
  );
}
