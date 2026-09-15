# Implementation Plan: v1alpha3 container security

## 1. Summary

Security-sensitive CI contract improvement after successful PR #16. Adopt shared
actions revision `bb40579c285df0b581c48b10f9b34574d5c78639`, run governed production
image checks before ECS publication, and retain failure diagnostics.

## 2. Goals

- Scan this frontend's linux/amd64 production image on PRs, main and manual CI.
- Gate ECS publication and explicitly select signed v1alpha3 evidence.
- Preserve complete reports and policy diagnostics on rejection or errors.
- Include existing local AGENTS.md and .ai/ changes; ignore generated tooling.

## 3. Non-goals

No frontend features, static-artifact admission, exemptions, ignore rules, merge,
workflow dispatch, ECR copies, deployment or AWS mutations. Static OCI publication
keeps its independent contract and dependencies.

## 4. Current State

Fetched upstream main is `979ae006b494f0b79c89f9026cadd57cf4a52e9d`. CI has separate
check, automation-quality, container-smoke and publication jobs. Both shared
actions use `9b7b5a601367a45356687a0e1bf1d1638d62aca9`. Dockerfile copies the Vite
build into unprivileged Nginx; Python/MCP packages are absent from this runtime.
Automation tests assert matching pins but omit v3 selection and scan retention.
Local changes consist of generated AGENTS.md and canonical/generated AI folders.

## 5. Requirements and Assumptions

### Confirmed Requirements

Use one issue, fresh branch from latest main, one PR, [ai] commits/title. Preserve
local changes. Run npm run check, production smoke and real shared scan.

### Assumptions

GitHub's read-only job token can read the public central policy repository.
Existing canonical publication job ID and display name remain profile-bound.

### Open Questions

Resolved by inspection: v1alpha3 is opt-in; local helper needs Node 24 and GH_TOKEN;
it preserves report.partial.json on operational errors and vulnerabilities.json,
vulnerability-policy.json and summary.txt after an evaluated result. Actual image
findings were initially unknown; the completed scan/remediation results are in
`docs/container-security.md` (164 baseline findings reduced to zero with the
pinned Nginx 1.30.4 / Alpine 3.24.1 runtime refresh).

## 6. Proposed Design

Add container-security-check with contents:read only and no event exclusion. Build
the prod target for linux/amd64 with the shared checkout outside its Docker
context. Invoke the reviewed helper with v1alpha3/reservation-web and upload the
entire diagnostics directory under !cancelled(), preserving failure status.
ECS publication needs this job plus its existing gates. Both shared actions use
the reviewed SHA; evidence action receives evidence-version:v1alpha3 and the
published digest. Shared action retains rejected diagnostics and signs exactly
four canonical files after successful provenance, scan and policy evaluation.

Frontend architecture review: all work belongs at build/runtime boundaries; no
domain/application/UI changes are necessary. KB Environment Release Manifest
reinforces separate immutable candidate creation and environment selection.

## 7. Alternatives Considered

### A: Separate read-only security job (selected)

Clear permissions and required dependency; independently retains diagnostics.
Costs one additional production build. Scans main too, so the dependency cannot
skip canonical publication. Adapts MCP #11/#9 without their PR-only exclusion.

### B: Scan only inside privileged publication

Retains exact digest identity but leaves PR feedback missing; rejected. Reusing
smoke-job image through an archive adds transfer complexity for this small image.

## 8. API / Interface Changes

Evidence document changes to component-candidate-evidence-v1alpha3.json. Artifact
name and other three files remain stable. New required CI job. Central latest
approved policy revision is fetched independently of the implementation pin.

## 9. Data Model / Persistence Changes

None. Diagnostic and evidence artifact retention is 14 days.

## 10. Security, Privacy, and Abuse Considerations

No credentials persisted by checkout, no application installs on privileged
host, no PR publishing/attestation/login. Scanner uses isolated digest-pinned
Trivy with all severities, unfixed findings and no producer suppressions. Policy
lookup failure must fail closed. Diagnostic artifacts carry no admission authority.

## 11. Performance, Scalability, and Reliability Considerations

20-minute scan job bound; shared scanner/evaluator enforce their own time/output
bounds. Registry/database/API failure fails CI with available diagnostics retained.
Main publication concurrency must not cancel prior main runs.

## 12. Implementation Steps

1. Update .gitignore and .dockerignore for generated AI/scanner directories;
   preserve and include AGENTS.md/.ai; verify git status and ignore behavior.
2. Update .github/workflows/ci.yml pins, v3 input, production target/platform,
   read-only scan and retention job, publication needs; inspect complete YAML.
3. Build/smoke/scan Dockerfile prod target using the pinned shared helper. Remediate
   reported runtime findings with targeted image/package updates only; rescan.
4. Extend automation/repository/test/workflow-contract.test.mjs for events,
   permissions, dependencies, version/pins, failure propagation and retention.
   Use executable command checks where useful; run npm run check.
5. Update README.md and docs/container-security.md with runbook, observed results
   and cross-repository dependencies. Review security/diff; commit/push/open PR.

## 13. Testing Strategy

Existing frontend and static-contract suites via npm run check. Automation
regressions cover trigger reachability and privilege separation, exact published
digest, shared pins, v3 input, status propagation and unconditional diagnostics.
Build with --pull --platform linux/amd64 --target prod. Smoke /health, root HTML,
non-root runtime. Actual shared v3 scan records image ID, report hash, severities,
policy revision and decision; local runs cannot prove signed publication.

## 14. Rollout / Migration Plan

Review PR CI before merging (merge is operator-owned). A future canonical main
run creates new signed evidence. Coordinate hosted v3 admission separately in
movie-platform-environments; producer success is not admission. Rollback by a
reviewed revert of pins/version selection; never bypass a failing security gate.

## 15. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Runtime findings | Blocks rollout | Unknown | Real scan, targeted remediation |
| Policy/network failure | CI rejection | Medium | Fail closed, retain full directory |
| Main scan skipped | Publisher skipped | Low | No event filter; test dependency |
| V3 reader not active | Admission rejects | Medium | Explicit downstream dependency |

## 16. Done Criteria

One issue/branch/PR; local changes included safely; checks/smoke/scan recorded;
no gate weakening; clear local/PR versus canonical evidence distinction.

## 17. Review Checklist

- [x] Requirements and non-goals explicit; conventions checked
- [x] Alternatives, security, reliability and tests considered
- [x] Rollout/rollback and ordered implementation defined
- [x] Final diff and local diagnostics reviewed; independent security review found no material issue
- [ ] Hosted PR CI reviewed after opening the PR

## 18. Handoff Prompt for Implementation Agent

Implement this plan in .github/workflows/ci.yml, automation/repository/test/
workflow-contract.test.mjs, Dockerfile if findings require it, .gitignore,
.dockerignore, README.md and docs/container-security.md. Preserve existing local
AGENTS.md/.ai changes. Run npm run check, Docker production smoke and the shared
v3 scan at bb40579. Record real results and cross-repo dependencies. No exemptions,
merge, dispatch, deployment or AWS mutations. User has authorized implementation,
issue creation, commits, branch push and one follow-up PR.
