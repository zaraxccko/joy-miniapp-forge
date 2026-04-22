# ===== Frontend Dockerfile =====
# Собирает Vite-проект и отдаёт статику через Caddy.
# VITE_* переменные ВКОМПИЛИРОВАНЫ на этапе build, поэтому передаём через --build-arg.

# ----- Build stage -----
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=/api
ARG VITE_ADMIN_IDS=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_IDS=$VITE_ADMIN_IDS

COPY package.json package-lock.json* bun.lock* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ----- Runtime stage -----
FROM caddy:2-alpine
WORKDIR /srv
COPY --from=build /app/dist /srv
COPY Caddyfile.frontend /etc/caddy/Caddyfile
EXPOSE 80
