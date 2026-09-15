# Project AI Guidance

This repository owns the standalone Vite/React reservation frontend. Its first
screen is the usable reservation workflow, and its production output is a
static artifact deployed by platform infrastructure through private S3 and
CloudFront.

## Repository Layout

- `src/features/`: feature-owned domain, application, adapter, and UI code.
- `src/platform/`: shared browser/runtime adapters such as GraphQL and trace
  context.
- `scripts/`: static-artifact contract tooling.
- `env_files/`: local templates and runtime configuration inputs.
- `.ai/`: canonical AI guidance, skills, and read-only review agents.

## Development Commands

- Install: `npm ci`
- Development server: `npm run dev`
- Full check: `npm run check`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Build: `npm run build`
- Static artifact: `npm run build:static-artifact`

Inspect `package.json` before inventing commands. Run `npm run check` before
handing back frontend behavior or artifact changes.

## Architecture And UX Rules

- Keep the first screen as the working reservation experience.
- Keep domain and application workflows independent of React, `fetch`, and
  browser globals where practical.
- Keep API access behind typed feature adapters rather than direct component
  calls.
- Treat GraphQL responses and browser/runtime values as untrusted until parsed
  at the boundary.
- Keep components focused on rendering and user interaction; put reusable
  workflow rules in application/domain code and orchestration in hooks/adapters.
- Preserve traceparent, correlation ID, request ID, and diagnostic evidence used
  by the platform demo.
- Keep layouts responsive and accessible; avoid controls or text overlapping at
  desktop or mobile widths.

## Repository Boundaries

- This repository publishes a static build artifact and its contract metadata.
- `movie-platform-environments` selects immutable artifact identities.
- `movie-platform-infra` owns S3, CloudFront, routing, and deployment.
- Do not add or mutate AWS resources from this repository.

## Testing Guidance

- Test pure domain and workflow behavior without React when possible.
- Test parsers and API adapters at external trust boundaries.
- Use React/component tests only when rendering, accessibility, or interaction
  behavior is the contract.
- Preserve regression coverage for polling, stale requests, cancellation,
  response parsing, and observability propagation.

## Safety

- Do not commit secrets, tokens, local rendered env files, or production data.
- Do not expose internal service errors or sensitive diagnostics in the UI.
- Do not push, deploy, promote, or mutate shared environment state without an
  explicit user request.

## Planning And Review

- Use `principal-engineer-planner` before non-trivial workflow, public contract,
  static-artifact, routing, or observability changes.
- Save implementation plans under `docs/plans/`.
- Ask review agents for findings first and require file/line evidence.
