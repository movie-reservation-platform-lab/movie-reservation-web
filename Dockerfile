# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine

FROM ${NODE_IMAGE} AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM ${NGINX_IMAGE} AS prod

COPY container/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8088
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD \
  wget --quiet --output-document=- http://127.0.0.1:8088/health >/dev/null || exit 1
