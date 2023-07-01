#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

echo "Are you sure you wish to wipe all cache data? (y/n)"
read answer

if [ "$answer" != "${answer#[Yy]}" ] ;then
    echo "Wiping cache data..."
else
    echo "Aborting..."
    exit
fi

sudo docker volume rm redis_data