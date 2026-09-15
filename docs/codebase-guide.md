# Reading and maintaining the frontend

Start with `npm ci --ignore-scripts` and `npm run check`. The tests use local
fixtures and do not require running backend services. For an interactive session,
follow [local setup](../README.md#run-with-local-observability) and
[demo login](booking-access-and-availability.md).

## A useful first reading path

1. [App](../src/app/app.tsx) chooses the authentication provider and renders audit,
   login or booking content. This is the application composition root: the place
   that selects concrete implementations. Demo login controls the UI only.
2. [MovieReservationDemo](../src/features/movie-reservations/ui/movie-reservation-demo.tsx)
   composes catalog, availability, booking and agent controllers. Start here to
   see which callback connects two panels.
3. [Domain types](../src/features/movie-reservations/domain/movie-reservation.ts)
   distinguish a movie, screening, seat, reservation request and final reservation.
   [Catalog reconciliation](../src/features/movie-reservations/domain/catalog-selection.ts)
   preserves valid selection IDs on both initial load and reload.
4. [Reservation workflow](../src/features/movie-reservations/application/request-reservation-workflow.ts)
   submits, polls and fetches the confirmed result through an injected API.
   This code has side effects but does not depend on React or browser globals.
5. [React reservation adapter](../src/features/movie-reservations/adapters/react/use-reservation-workflow.ts)
   turns seat selections into that command and maps workflow events into state.
6. [GraphQL feature adapter](../src/features/movie-reservations/adapters/graphql/movie-reservation-api.ts)
   owns operation documents and feature parsers. The
   [platform client](../src/platform/api/graphql-client.ts) handles HTTP and tracing;
   the feature parser validates the returned data before it becomes domain data.

The audit feature has its own [request controller](../src/features/audit-demo/adapters/react/use-audit-check.ts)
and [HTTP adapter](../src/features/audit-demo/adapters/http/audit-client.ts). It
shares credential-check infrastructure with demo login but does not create a
session. The current agent client is in `src/platform/api/agent-client.ts`; its
request/response types and parsers are colocated there. It is feature-specific in
practice, unlike the generic GraphQL transport, so look there when tracing agent
calls rather than assuming every feature API lives in its feature folder.

## Where to make a change

| Change | Owner | First test to inspect |
| --- | --- | --- |
| Movie/screening/seat selection rules | `movie-reservations/domain/` | `movie-reservation-domain.test.ts` |
| Reservation polling and terminal results | `movie-reservations/application/` | `request-reservation-workflow.test.ts` |
| Occupancy refresh and stale responses | `movie-reservations/adapters/react/use-screening-availability.ts` | `use-screening-availability.test.tsx` |
| Demo session lifecycle | `authentication/adapters/use-authentication.ts` | `use-authentication.test.tsx` |
| Backend fields or malformed responses | Feature API adapters/parsers | Adjacent parser/client tests |
| Visible interaction or accessibility | Feature `ui/` components | `movie-reservation-demo.test.tsx`, `app.test.tsx` |
| Security CI gates and publication | `.github/workflows/ci.yml` | `automation/repository/test/workflow-contract.test.mjs` |
| Static build handoff | `scripts/write-static-artifact-contract.mjs` | `automation/static-artifact/test/` |

Paths without a `src/` prefix in the feature rows are relative to
`src/features/`. Existing `src/test-support/` helpers provide deferred promises
and a booking API fixture for interaction tests.

## Async behavior that is easy to miss

`activeRunIdRef` is a local counter, not a backend request ID or a trace ID.
Starting a new operation or cleaning up a hook invalidates older callbacks. A
response may still arrive, but it cannot overwrite the current state. The hooks
deliberately keep their own guards because their cancellation rules differ.

- Authentication also aborts its pending sign-in through
  `pendingSignInControllerRef`. The run guard remains necessary if a provider
  resolves despite that abort.
- Agent and reservation controllers use a ref as a synchronous submission lock.
  React state drives rendering; it cannot prevent a second click before React
  renders the first state change.
- Availability belongs to the exact screening and API objects. A catalog reload
  can replace those objects while keeping the screening ID. Comparing only IDs
  would let stale occupancy briefly enable seats.
- `onSettledRef` and `onCompletedRef` call the latest refresh callback after an
  async operation. Capturing an older callback can refresh the wrong snapshot.
- `ReservationPollingTimeoutError` means the frontend exhausted its polling
  budget. It does not mean the backend cancelled or rejected the reservation.
  User-facing messages map by error type, never by diagnostic prose.

The trace context called `workflow` groups related network calls for diagnostics.
It is separate from the application use case named `requestReservationWorkflow`
and the React controller's local run counter.

## Tests and deployment tooling

`npm run test:web` runs domain, adapter and React tests in `src/`.
`npm run test:automation` runs tooling and workflow contracts in `automation/`.
Use `npm run check` before handoff; it runs both suites, typechecking and the
static-artifact build. Use existing deferred-promise tests when changing request
ownership so out-of-order responses remain covered.

The workflow tests inspect the repository's current YAML indentation and execute
the scanner shell command with a process double. They protect caller permissions,
pins, step ordering, exit status and retention; they do not execute hosted signing.
For real image scans and the distinction between diagnostics and signed evidence,
read [container security](container-security.md). The static-site OCI bundle and
the temporary runnable Nginx image have separate publication paths.

## Naming and comments

Prefer names that explain responsibility (`reconcileCatalogSelection`,
`pendingSignInControllerRef`) and small functions with one visible task. Comments
should explain invariants, units, lifecycle ownership and boundaries. Straightforward
rendering and field access do not need a docstring per function. Domain and
application code should remain independent of framework/runtime adapters.
