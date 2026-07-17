# --- Base Node Stage ---
FROM node:20-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install

# --- Stage 1: Development ---
FROM base AS development
COPY . .
RUN npx playwright install chromium --with-deps
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# --- Stage 2: Builder ---
FROM base AS builder
COPY . .
RUN npm run build

# --- Stage 3: Production ---
FROM nginx:1.25-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
