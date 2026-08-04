# Movie Reservation Web

React frontend for clicking through the movie reservation flow while preserving
the observability headers used by the backend.

## Run With Local Observability

This repository was extracted from
`movie-reservation-platform-lab/golden-path-ecs-template` so the frontend can
have an independent CI and static artifact pipeline. Keep the golden-path copy
as the migration source until this repository passes CI and an AWS smoke check.

Start the backend dependencies and API from the reservation service or platform
runtime workspace:

```sh
docker compose up -d postgres
docker compose --profile observability up -d otel-collector
npm run db:migrate:local-postgres
npm run db:seed:local-postgres
docker compose --profile api up -d --build api
```

Then start the frontend:

```sh
npm ci
mkdir -p env_files/local
cp env_files/templates/local/local-dev.env.template env_files/local/local-dev.env
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The frontend sends GraphQL requests through Vite's `/graphql` proxy. By default
the proxy targets `http://127.0.0.1:3001`, which matches the containerized API
profile documented in `docs/workflows/local-observability.md`.

The frontend dev script loads `env_files/local/local-dev.env`. Edit that
rendered file if your API runs on another port:

```env
VITE_API_PROXY_TARGET=http://127.0.0.1:3000
```

Optional local-only settings:

- `VITE_GRAPHQL_URL` overrides the browser GraphQL endpoint. Leave it unset to
  use the Vite `/graphql` proxy.
- `VITE_DEMO_BEARER_TOKEN` sends a local demo bearer token with GraphQL
  requests while running the Vite dev server. `VITE_*` values are visible to
  browser code, so this value is not a secret. Local fixed-user backend profiles
  do not need it. Local JWT profiles can use a JWT-shaped value that the backend
  decodes without production signature, issuer, audience, expiry, or JWKS
  validation. Production-shaped auth should use a later OIDC flow, not this env
  value.

## Demo Flow

1. Load catalog data.
2. Select a movie.
3. Pick a screening.
4. Select one or more seats.
5. Request a reservation.
6. Watch polling move the request into a terminal state.
7. Use the browser network panel to inspect the emitted propagation headers,
   then search for the workflow in Grafana/Tempo/Loki. A future Playwright
   smoke test should capture the same workflow in an automated report.

The current backend API returns auditorium seats, not a dedicated availability
calculation. Already-reserved seeded seats are still clickable and should become
useful rejection demos.

## Deployment Contract

The production target is a Vite static build deployed by platform
infrastructure to private S3 behind CloudFront. This repository should publish
the immutable frontend artifact; environment composition belongs to the platform
environment/infra repos.
