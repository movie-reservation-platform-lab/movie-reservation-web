---
name: vitest-testing
description: Use when creating, refactoring, reviewing, or explaining frontend tests with Vitest, including domain and workflow tests, parser and API-adapter tests, React interaction tests, fake timers, test doubles, and regression coverage.
---

# Vitest Testing

Keep frontend tests behavior-focused and place them at the lowest boundary that
can prove the contract.

## Test Selection

- Test domain transformations and application workflows as plain TypeScript.
- Test GraphQL parsers, response normalization, and header propagation directly.
- Test hooks/components only when lifecycle, rendering, accessibility, or user
  interaction is the behavior.
- Prefer real domain/application code with narrow fake ports.
- Use `vi.fn()` or `vi.spyOn()` when an outbound interaction is the contract.
- Avoid asserting implementation details such as internal hook calls or private
  component state.

## Async And Time

- Use fake timers for polling, retry, timeout, and delayed-state workflows.
- Advance time explicitly; do not make tests wait in real time.
- Cover stale-response and overlapping-request behavior when async work can race.
- Restore globals, timers, and mocks in cleanup so tests remain independent.

## Boundary Coverage

- Cover malformed or partial API responses, non-success status codes, and safe
  error mapping.
- Assert `traceparent`, correlation ID, request ID, and demo-fault propagation
  where an adapter owns those headers.
- Test static-artifact scripts through their public command/output contract when
  they change.
- Add a regression test for each fixed user-visible or contract bug.

## Organization

- Keep tests next to the feature code while they are feature-specific.
- Extract shared factories/fakes only after reuse appears.
- Prefer explicit scenario setup to broad global fixtures.
- Name tests by observable behavior and relevant condition.

## Verification

Run focused Vitest files while iterating, then run:

```bash
npm run check
```
