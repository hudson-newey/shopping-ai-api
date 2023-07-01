#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# port forward and expose on port 6379
# create persisitant data volume located at /redis_data
sudo docker run -p 6379:6379 -v redis_data:/data -it redis/redis-stack-server:latest
