# Dockerfile
FROM node:12-slim

# put the app in the right folder
RUN mkdir -p /var/app
WORKDIR /var/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY ./package*.json /var/app/

# RUN npm install
# If you are building your code for production
RUN npm i --only=production

# Bundle app source
COPY ./ /var/app

EXPOSE 1883
CMD [ "node", "-r", "esm", "index.js" ]

# LABEL traefik.backend=${CI_ENVIRONMENT_SLUG:-master} traefik.frontend.rule=Host:mqtt.dataiot.ca traefik.docker.network=web traefik.enable=true traefik.port=1883
