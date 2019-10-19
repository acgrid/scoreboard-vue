#!/bin/bash
yarn install --production=false
NODE_ENV=production yarn build:server
NODE_ENV=production yarn build --modern
production

systemctl restart scoreboard
systemctl restart nginx