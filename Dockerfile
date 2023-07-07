FROM node:20-alpine
WORKDIR /app

COPY package.json /app
RUN npm install --omit=dev
COPY . /app

# Add Redis server dependency
RUN apk add --no-cache redis

# Start Redis server
CMD redis-server & npm start

EXPOSE 8080
