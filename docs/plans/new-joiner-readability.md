# Implementation Plan: New joiner readability

## 1. Summary

Behavior-preserving maintainability refactor after the v1alpha3 rollout. Keep
existing feature boundaries and make lifecycle ownership and test intent explicit.

## 2. Goals

Explain where to start reading, use descriptive async-state names, simplify app
page selection, and make workflow-contract tests straightforward to maintain.

## 3. Non-goals

No new frontend behavior, dependencies, shared hook framework, transport changes,
CI permissions/policy changes, publication, admission or deployment.

## 4. Current State

Domain transformations and feature GraphQL parsers already have focused names and
responsibilities. Application orchestration is framework-independent. Friction:
`use-authentication.ts` and `use-screening-availability.ts` use generic `State`,
`generation`, `run`; auth's `pending` holds a controller, while its UI state also
has a pending variant. Agent/catalog hooks use the same opaque stale-result guard.
`App` selects four page cases through nested ternaries. Workflow tests interleave
helpers and tests and pack parsing/ordering assertions into long expressions.
README has operational runbooks but no source reading path.

## 5. Requirements and Assumptions

### Confirmed Requirements

Review newcomer comprehension, evaluate findings and implement useful fixes.
Preserve existing changes and run npm run check.

### Assumptions

Preserve existing exported behavior and observable request/cancellation ordering.

### Open Questions

None blocking. Independent reviewer checks feature code for additional findings.

## 6. Proposed Design

Use operation-specific state names and `activeRunIdRef`/`runId` for stale-result
guards; describe invalidation versus request aborting. Name the sign-in controller
and synchronous duplicate-submission locks. Expose explicit authentication and
availability hook contracts. Extract an app content component with guard returns.
Add narrowly scoped workflow-source test helpers with useful missing-block errors.
Add docs/codebase-guide.md covering composition, use cases, adapters, tests and
the distinction between tracing context, request generations and backend IDs.

## 7. Alternatives Considered

- Selected: local names, boundary comments and small helpers. Low risk; existing
  tests exercise the same behavior and maintainers can follow each operation.
- Rejected: generic request lifecycle abstraction or wholesale architecture
  reorganization. Hides distinct cancellation rules and adds unnecessary migration.

## 8. API / Interface Changes

Add descriptive exported hook types; runtime contracts stay unchanged.

## 9. Data Model / Persistence Changes

None.

## 10. Security, Privacy, and Abuse Considerations

Preserve auth's UI-only gate, credential handling, request invalidation and all
security CI assertions. No diagnostic/logging or policy changes.

## 11. Performance, Scalability, and Reliability Considerations

Keep effect dependencies and operation ordering unchanged. Avoid new hooks,
requests, state updates or timers. Preserve stale response and unmount behavior.

## 12. Implementation Steps

1. Rename private lifecycle variables and state types in auth, availability,
   catalog, agent and reservation hooks; clarify invariants in comments.
2. Simplify App page selection using explicit authentication contract. Refine
   application workflow comments that currently call side-effectful code pure.
   Reviewer found polling error-message substring matching: add an application
   ReservationPollingTimeoutError and map by type, preserving visible messages.
   Consolidate catalog reconciliation into reconcileCatalogSelection returning
   CatalogSelection; remove the unused didScreeningChange wrapper and update its
   existing domain tests. Verify timeout mapping independently of error prose.
3. Restructure automation/repository/test/workflow-contract.test.mjs into readable
   groups/helpers. Preserve all assertions and exercise missing-block diagnostics.
4. Add source-reading/test guide linked early in README; record review findings.
5. Run npm run check and git diff --check; review behavior-preserving diff.

## 13. Testing Strategy

Existing authentication, availability, app and reservation interaction tests cover
race, cancellation, expiry, selection and rendering contracts. Existing workflow
tests continue to exercise shared-scanner exit codes and permission/retention
invariants. Full npm run check is required; no container rebuild is needed for
names/comments or equivalent rendering organization.

## 14. Rollout / Migration Plan

No runtime migration. Revert this focused diff if needed; keep prior security
rollout intact. No external publication required for local review fixes.

## 15. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Rename changes a guard or effect | Preserve expressions and dependencies; regression suite |
| Helper weakens workflow assertions | Keep exact expected contracts and test missing block |
| Documentation promises too much | Distinguish reviewed areas from remaining follow-up work |

## 16. Done Criteria

Concrete findings addressed; source map and lifecycle comments checked against
code; existing behavior and CI guard assertions pass.

## 17. Review Checklist

- [x] Scope, alternatives, security and reliability considered
- [x] Concrete files and regression strategy identified
- [x] Review findings reconciled and checks complete

Review outcome: domain functions and API boundaries were already approachable.
The main maintenance risks were hidden error-message coupling and opaque async
ownership; both are addressed. Catalog reconciliation and App page selection are
simpler, workflow tests explain their source-reading limits and report missing
steps, and README links the source guide. Independent follow-up review found no
remaining concrete issues in the modified frontend code. `npm run check` passed
103 frontend and 23 automation tests, typecheck and static-artifact build.

## 18. Handoff Prompt for Implementation Agent

Apply the bounded refactor above. Do not add libraries or change async ordering,
permissions, rendering behavior or public backend contracts. Use existing tests,
then npm run check and git diff --check. User has asked for fixes, so proceed
from this plan into implementation.
