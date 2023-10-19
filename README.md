# AI Shopper API

Should be run in combination with [hudson-newey/shopping-ai-client](https://github.com/hudson-newey/shopping-ai-client)

To build: Install and enable the compile hero vsCode extension

To run:

```sh
$ npm start
>
```

Built using:

* NodeJS
* ExpressJS
* Redis
* OpenAI GPT-3.5 API

NodeJS is the language engine to run the API

ExpressJS allows us to process multiple requests through multithreading

Redis lets us cache responses to save money on the expensive OpenAI API

OpenAI GPT-3.5 API is used to generate responses

## Routes

### Requesting a response with query string parameters + history

```js
POST /api/?q=query
{
    history: [
        { role: "user", content: "this is a request" },
        { role: "assistant", content: "this is a response" }
        { role: "user", content: "this is another request" }
    ]
}
```

### Requesting a response with request in body

```js
POST /api/
{
    history: [
        { role: "user", content: "this is a request" },
        { role: "assistant", content: "this is a response" }
        { role: "user", content: "this is another request" }
    ],
    q: "query"
}
```

### Requesting robots.txt

```js
GET /robots.txt
```

### All other routes

All other routes will return a 404 status code without any content or pages. This is done to prevent hackers

## Environment Variables

`OPENAI_API_KEY`=your open ai api key. get it here: https://platform.openai.com/

`CLIENT_ENDPOINT`=if a user tries to access the root directory, where should they go?

`DEVELOPMENT`=determines if non-cached responses are fetches from the openai API. This is done to reduce costs
