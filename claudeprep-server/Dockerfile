FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000

# Seed DB on first start, then launch server
CMD node db/seed.js && node server.js
