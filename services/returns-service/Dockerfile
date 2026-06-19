FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared ./shared
COPY gateway ./gateway
COPY services ./services

RUN npm install --omit=dev

ENV NODE_ENV=production

EXPOSE 3008

CMD ["npm", "run", "start:returns"]
