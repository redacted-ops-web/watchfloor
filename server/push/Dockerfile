FROM node:22-alpine
WORKDIR /app
RUN npm install --omit=dev web-push@3.6.7
COPY server.js /app/server.js
RUN chmod 644 /app/server.js
USER node
CMD ["node", "/app/server.js"]
