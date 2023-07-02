# AI Shopper API

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

`/api/?q=query&v=sessionId`

generates an AI response

`/session/?v=sessionId`

Fetches the session content

`/session/clear/?v=sessionId`

Removed the session

`/session/new`

Requests a new session id from the api
