const { Configuration, OpenAIApi } = require("openai");
const express = require("express");
const cors = require("cors");
const redis = require("redis");
require("dotenv").config();

const redisClient = redis.createClient();
const app = express();
const port = 8080;

const promptPrepend = "what items from amazon would i need for ";
const promptAppend =
  ". list the items in numbered bullet points using the \\nn. format";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.use(cors()); // Add CORS middleware here

function toDbKey(message: string): string {
  // reducing the message to its most descriptive components increases the chance of a cache hit
  message = message.trim()
    .toLowerCase()
    .replace(/[^\w\s]|_/g, "")
    .replace(/\s+/g, " ")
    .replace(" ", "-");

  return message;
}

app.get("/api/", async (req, res) => {
  const { query } = req;

  const userQuery = query?.q;

  if (!userQuery) {
    res.send("Error 101: Bad format");
  } else {
    console.log(`request: ${query.q}`);

    // check if the response has been cached
    const hasCachedResponse: boolean = await redisClient.exists(toDbKey(userQuery));

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
        messages: [{ role: "user", content: promptPrepend + userQuery }],
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

    console.log();
  }
});

app.listen(port, async () => {
  await redisClient.connect();
  console.log(`api listening on port ${port}`);
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
