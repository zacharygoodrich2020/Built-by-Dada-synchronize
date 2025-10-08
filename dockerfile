FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci || npm i
COPY . .
RUN mkdir -p data
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
