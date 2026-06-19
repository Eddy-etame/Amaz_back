FROM node:20-alpine

WORKDIR /app

# Fichiers racine (workspaces) + code partagé + admin-service.
COPY package.json package-lock.json ./
COPY shared ./shared
COPY admin-service ./admin-service

# Installe les dépendances (workspaces) — admin-service est un workspace.
RUN npm install --omit=dev

ENV NODE_ENV=production

EXPOSE 3010

CMD ["npm", "run", "start:admin"]
