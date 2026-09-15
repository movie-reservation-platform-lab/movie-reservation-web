# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:24-alpine
# Reviewed runtime refresh; update this digest with a production smoke and scan.
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.4-alpine@sha256:adf5042a17f4ecdd200c595fa9ffd1be37efb18f89a830bd1a00e4ab4d59d42c

FROM ${NODE_IMAGE} AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

FROM ${NGINX_IMAGE} AS prod

COPY container/nginx.conf /etc/nginx/conf.d/default.conf
COPY container/audit-proxy.conf /etc/nginx/audit-proxy.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8088
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD \
  wget --quiet --output-document=- http://127.0.0.1:8088/health >/dev/null || exit 1
