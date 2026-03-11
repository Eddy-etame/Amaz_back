FROM node:20-alpine

WORKDIR /app

# Copy root package files and shared code
COPY package.json package-lock.json ./
COPY shared ./shared
COPY gateway ./gateway
COPY services ./services

# Install all dependencies (workspace)
RUN npm ci --omit=dev

ENV NODE_ENV=production

EXPOSE 3003

CMD ["npm", "run", "start:order"]
