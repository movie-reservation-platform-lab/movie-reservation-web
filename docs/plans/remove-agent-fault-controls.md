# Implementation Plan: Ordinary agent booking (#23)

## Summary and goals
Remove request-controlled faults from the web UI and transport. Preserve real agent booking, safe failure feedback, correlation, and booking refresh behavior.

## Current state
`agent-panel.tsx` renders a fault selector and three prompt presets. `use-agent-reservation.ts` stores and submits faults. `agent-client.ts` sends both a fault body field and header. The hook suppresses stale completions but does not abort fetch; error text is rendered directly. Nginx explicitly forwards the fault header.

## Requirements and scope
Remove slow/error presets, fault state, types, body fields and headers. Retain an ordinary booking preset. Display safe errors and selectable full diagnostic IDs. Preserve synchronous real-agent response parsing; no asynchronous contract is evidenced here. Backend fault rejection and downstream propagation acceptance belong to their owning repositories. No deployment, live checks, dependencies, or private operational material.

## Design and alternatives
Remove the feature throughout UI, hook, and client rather than hiding controls while retaining fault transport. Explicitly serialize only booking fields and allowlisted headers. Strip the legacy header at the temporary Nginx proxy; this does not replace backend authorization. Keep existing GraphQL and trace generation, which have no fault wiring. Use AbortController on workflow reset/unmount and retain stale-run guards. Use fixed failure copy rather than rendering arbitrary server/parser messages. Expose client-generated workflow correlation/trace IDs and request ID when a structured result exists.

## Implementation steps
1. Remove fault controls and slow/error presets in the panel/hook/client; update single-preset layout and Nginx header handling.
2. Add lifecycle cancellation, clear obsolete results on resubmission, safe failure text, and full selectable diagnostic references.
3. Update client/header and container contract tests; add panel lifecycle, failure, retry and ordinary-booking regressions.
4. Update README with normal agent flow and precise frontend signal scope. Run `npm run check`.

## Risks and verification
Backend may still accept arbitrary fault arguments: web removal cannot prove backend enforcement. Fetch abort does not cancel a booking already executing remotely; avoid automatic retries and tell users to check reservations after ambiguous failures. Assert no raw errors/prompts/tokens appear in diagnostics or logs. Preserve direct-booking regression coverage and request correlation on success/failure.

## Rollout and rollback
Publish/deploy only through a separately authorized artifact rollout. Rollback selects the prior immutable artifact. No persistence migration.

## Done criteria and review
All fault wiring removed, normal requests preserved, safe failures and diagnostics covered, cancellation and repeated submissions tested, full check passes. Read-only review should report findings with file/line evidence.

## Implementation handoff
Implement the steps above in this repository only; keep existing feature boundaries and run `npm run check`. User has explicitly requested implementation after planning.
