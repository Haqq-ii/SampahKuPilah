# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS base
WORKDIR /usr/src/app

# Install dependencies separately for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy project files
COPY . .

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
