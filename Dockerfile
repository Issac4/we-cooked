# syntax=docker/dockerfile:1

# ---- Build: install everything, build the web app and the server bundle ----
FROM node:24-bookworm-slim AS build
WORKDIR /src

# Toolchain only used if a native module has no prebuilt binary.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

COPY . .
RUN npm run build \
 && npm prune --omit=dev \
 && mkdir -p server/node_modules

# ---- Runtime: Node + production dependencies + built files only ----
FROM node:24-bookworm-slim
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    PORT=8000 \
    DATA_DIR=/data \
    WEB_DIR=/app/web \
    MIGRATIONS_DIR=/app/drizzle

WORKDIR /app
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/server/node_modules ./node_modules
COPY --from=build /src/server/dist ./dist
COPY --from=build /src/server/drizzle ./drizzle
COPY --from=build /src/web/dist ./web

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
