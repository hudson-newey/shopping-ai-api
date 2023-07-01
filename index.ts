const { Configuration, OpenAIApi } = require("openai");
const express = require("express");
require("dotenv").config();

const app = express();
const port = 8080;

const promptPrepend = "what items from amazon would i need for ";
const promptAppend = ". list the items in numbered bullet points using the \\nn. format";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.get("/", async (req, res) => {
  const { query } = req;

  if (!query?.q) {
    res.send("Error: Bad format");
  } else {
    const chatCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{role: "user", content: promptPrepend + query.q}],
    });
    res.send(chatCompletion.data.choices[0].message);
  }
});

app.listen(port, () => {
  console.log(`api listening on port ${port}`);
});
