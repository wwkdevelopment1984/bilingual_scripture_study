# Bilingual Scripture Reader - production image for the MemorySphere home server.
#
# The app is never published on a host port: Caddy reverse-proxies
# /scripture/* to this container over the internal "ms" network.
#
# Build + run from this directory:
#   docker compose -f compose.home-server.yaml up -d --build

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --legacy-peer-deps

COPY tsconfig.json vite.config.ts index.html server.ts ./
COPY server ./server
COPY src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    APP_BASE_PATH=/scripture

WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json server.ts ./
COPY --chown=node:node server ./server
COPY --chown=node:node src ./src

USER node
EXPOSE 3000
CMD ["node", "server.ts"]
