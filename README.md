# Movie Reservation Web

React frontend for clicking through the movie reservation flow while preserving
the observability headers used by the backend.

## Run With Local Observability

This repository was extracted from
`movie-reservation-platform-lab/golden-path-ecs-template` so the frontend can
have an independent CI and static artifact pipeline. Keep the golden-path copy
as the migration source until this repository passes CI and an AWS smoke check.

Start the backend dependencies and API from a checkout of
[`movie-reservation-platform-lab/movie-reservation-service`](https://github.com/movie-reservation-platform-lab/movie-reservation-service),
which owns the Compose services and database commands below. These commands are
not provided by this frontend repository; prefer the service repository's
runbook if it changes:

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
profile used by the local platform runtime.

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

## CI

The standalone repository runs GitHub Actions CI on pull requests, pushes to
`main`, and manual dispatches. The check job installs dependencies with
`npm ci`, runs `npm run check:web`, packages the tested `dist/` as a local OCI
layout, and uploads two short-lived review artifacts:

- `movie-reservation-web-static-${GITHUB_SHA}` contains the directly
  inspectable `dist/` files.
- `movie-reservation-web-oci-layout-${GITHUB_SHA}` contains the exact OCI
  layout eligible for publication.

Only a successful push to `main` starts the registry publication job. That job
copies the already-tested OCI layout to
`ghcr.io/movie-reservation-platform-lab/movie-reservation-web:sha-${GITHUB_SHA}`
and verifies that the remote digest matches the digest created by the check
job. Publication also requires the separate `automation-quality` job, which
tests repository and artifact automation without mixing those checks into the
frontend behavior test discovery path. Pull requests and manual runs never
receive package write permission.

The `sha-...` tag and package version are provenance hints, not deployment
selectors. Environment releases select the immutable `sha256:...` OCI digest
reported in the workflow summary.

Run the same verification locally before opening or updating a pull request:

```sh
npm run check
```

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

Create the production handoff artifact with:

```sh
npm run build:static-artifact
```

The artifact root is `dist/`. It must contain `index.html`, hashed Vite assets
under `assets/`, and `static-artifact-contract.json`. The generated contract
records the artifact kind, source revision and build evidence, sorted file
sizes and SHA-256 hashes, OCI media types, browser API expectations, cache
policy expectations, and the `traceparent`, `X-Correlation-Id`, and
`X-Request-Id` diagnostic headers that the platform demo depends on. The
contract excludes itself from its inner file list; the outer OCI manifest
digest covers the complete bundle, including the contract.

The production candidate is a non-runnable OCI artifact with artifact type
`application/vnd.movie-platform.static-site.v1` and one directory layer with
media type `application/vnd.movie-platform.static-site.layer.v1.tar`. The
`movie-platform-environments` repository allowlists that candidate as artifact
kind `static-site-bundle` and later selects it by digest.

Platform infrastructure owns S3 bucket policy, CloudFront distribution,
SPA fallback to `index.html`, cache headers, TLS, DNS, and API routing. In
production it should provide a same-origin `/graphql` route to the reservation
API, unless the frontend is intentionally built with `VITE_GRAPHQL_URL`.
Private admission, copying to a trusted registry, extraction into S3, rollout,
rollback, and AWS smoke verification remain outside this repository.

Keep the golden-path frontend copy as a migration reference until a pushed
standalone workflow proves candidate publication and the platform-owned AWS
smoke test proves the deployed reservation path. This repository does not
claim either gate from a local-only run.
