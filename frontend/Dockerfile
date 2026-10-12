FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2
COPY --from=build /app/dist /srv/frontend
COPY Caddyfile /etc/caddy/Caddyfile