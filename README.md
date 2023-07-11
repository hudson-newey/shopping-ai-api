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

### Requesting a response with query string parameters + history

```json
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

```json
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

```JSON
GET /robots.txt
```

### All other routes

All other routes will return a 404 status code without any content or pages. This is done to prevent hackers
