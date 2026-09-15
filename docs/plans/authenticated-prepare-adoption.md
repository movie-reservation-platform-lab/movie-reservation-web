# Implementation Plan: Authenticated Prepare Adoption

## 1. Summary

[Issue #19](https://github.com/movie-reservation-platform-lab/movie-reservation-web/issues/19)
adopts the authenticated prepare contract from
[movie-platform-actions #18](https://github.com/movie-reservation-platform-lab/movie-platform-actions/pull/18)
at reviewed commit `036531133bcefd454b5afc0eb55f8ba0328901ea` for the
temporary ECS image evidence path. The independent static-site publisher stays
unchanged.

## 2. Goals

- Move both publisher actions and the PR/local scanner checkout together.
- Pass the publishing job token explicitly to prepare.
- Protect the existing security and publication boundaries with offline tests.
- Document the complete shared release impact and coordinated rollback.

## 3. Non-goals

No application, Docker/dependency, vulnerability exemption, evidence schema,
static-site publication, permission, deployment, admission, or AWS changes.

## 4. Current State

Fresh upstream `main` is `aba0d34d28160cddb9fadf7a4c0c298a2b85d2ff`.
`.github/workflows/ci.yml` pins both shared publisher actions and the shared
scanner checkout to `bb40579c285df0b581c48b10f9b34574d5c78639`. Prepare does
not pass its newly required token. The ECS publisher already has the exact
canonical push/main/repository guard and `contents: read`, `packages: write`,
`id-token: write`, and `attestations: write`. The scanner job is read-only and
runs for PRs, main pushes, and manual CI. Static-site publication is separate.

## 5. Requirements and Assumptions

### Confirmed Requirements

Use the three coordinated reviewed pins and explicit prepare token while
preserving v1alpha3, `reservation-web`, existing authorities, and event gates.
Cover those invariants in `automation/repository/test/workflow-contract.test.mjs`.

### Assumptions

The existing job token has the required producer and central-policy read access;
private-repository compatibility remains a live acceptance question. The user
confirmed the recommendation-MCP canary's publication and admission runs.

### Open Questions

None block implementation. Hosted PR CI cannot exercise prepare because the ECS
publisher remains disabled on pull requests.

## 6. Proposed Design

Update exactly the three shared-tool references and add
`github-token: ${{ github.token }}` to the prepare step. Strengthen workflow
tests around exact pins, step-scoped token wiring, permissions, event guards,
and static/ECS separation. Update current caller documentation without rewriting
historical verification records.

## 7. Alternatives Considered

### Coordinated adoption (selected)

Moves authentication and the related bounded-report, sanitized-failure, and
scanner-cleanup hardening together. It follows the validated canary.

### Prepare-only update (rejected)

Would satisfy the new input but leave producer security tooling split across
releases and omit the caller migration guidance's coordinated rollback.

## 8. API / Interface Changes

Prepare receives its required caller-token input. There are no application,
evidence-schema, component-identity, or static-artifact contract changes.

## 9. Data Model / Persistence Changes

None.

## 10. Security, Privacy, and Abuse Considerations

The committed expression references the existing job token; no new secret is
introduced. Passing it does not narrow its authority, so the publisher's exact
permission set remains protected by tests. PR scanning remains read-only and
credential-restricted. No `pull_request_target` or environment reader-app
credential is introduced.

## 11. Performance, Scalability, and Reliability Considerations

The upstream release performs one bounded authenticated exact-main lookup and
fails closed. It also bounds legacy evidence reads, sanitizes failure output,
and detects scanner cleanup failure. Central-policy and scanner acquisition
remain separate live dependencies.

## 12. Implementation Steps

1. Update the three shared-action/tooling references and prepare token in
   `.github/workflows/ci.yml`.
2. Extend `automation/repository/test/workflow-contract.test.mjs` with exact
   token, permission, publication guard, and static-site separation assertions.
3. Update `README.md` and `docs/container-security.md` with the reviewed release,
   caller obligations, live-acceptance limit, and coordinated rollback.
4. Run the documented offline suite, review the bounded diff, commit/push the
   issue branch, open one PR, and inspect ordinary PR CI.

## 13. Testing Strategy

Run `npm ci`, `npm run check`, focused automation tests, and diff hygiene. Test
the exact three pins and token input plus the existing main-only, permissions,
PR scanning, no-`pull_request_target`, and static publisher boundaries.

## 14. Rollout / Migration Plan

Merge is operator-owned. After merge, select a new successful canonical `main`
run whose ECS publication completed and admit that exact run separately. Never
reuse historical producer runs. Rollback reverts all three pins and removes the
prepare token together, with matching tests and current documentation.

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Pin drift or missing token | Prepare fails closed | Exact step-scoped contract tests |
| Permission/event broadening | Untrusted publication authority | Exact job permission and guard assertions |
| Static publisher coupling | Frontend delivery regression | Assert it does not use container evidence |
| Overstated acceptance | Invalid rollout confidence | Separate offline, PR, canonical publication, and admission evidence |

## 16. Done Criteria

- One issue, branch, commit, and PR for this repository.
- Offline checks and read-only reviews pass.
- PR CI is reported without claiming canonical publication.
- No change outside the bounded caller migration.

## 17. Review Checklist

- [x] Requirements, non-goals, current contracts, and alternatives inspected.
- [x] Security, reliability, tests, rollout, and rollback defined.
- [ ] Final diff receives evidence-based security and maintainability review.
- [ ] Hosted PR CI is inspected after opening the PR.

## 18. Handoff Prompt for Implementation Agent

Implement steps 1–4 with the exact reviewed SHA. Preserve every stated boundary,
stop if compatibility requires broader changes, and report hosted acceptance
separately from offline verification.
