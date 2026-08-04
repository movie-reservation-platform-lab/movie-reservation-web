# Movie Reservation Web — AI Guidance

## Purpose

This repository owns the Vite/React browser UI for the movie reservation
platform. It should remain a static frontend artifact deployed through private
S3 and CloudFront by the platform infrastructure.

## Repository Rules

- Keep the first screen as the usable reservation experience, not a marketing
  page.
- Preserve propagation headers and diagnostic views used by the platform demo.
- Keep API access behind typed application adapters rather than direct calls
  from UI components.
- Do not deploy AWS resources from this repo.
- Publish static build artifacts or container/image metadata only when the
  platform contract explicitly asks for it.
- Keep rendered local env files untracked.

## Commands

- Install: `npm ci`
- Dev server: `npm run dev`
- Full check: `npm run check`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- Build: `npm run build`

Run `npm run check` before handing back frontend behavior changes.
