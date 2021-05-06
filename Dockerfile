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

LABEL traefik.enable=true traefik.tcp.routers.mqtt.rule=HostSNI(`mqtt.dataiot.ca`) traefik.tcp.routers.mqtt.entrypoints=mqtt traefik.tcp.routers.mqtt.tls=false traefik.tcp.routers.mqtt.service=mqtt traefik.tcp.services.mqtt.loadBalancer.server.port=1883

# traefik.enable=true traefik.tcp.routers.mqtt.rule=HostSNI(`mqtt.dataiot.ca`) traefik.tcp.routers.mqtt.entrypoints=mqtt traefik.tcp.routers.mqtt.tls=true traefik.tcp.routers.mqtt.service=mqtt
