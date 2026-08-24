# Implementation Plan: Issue #4 Standalone Static Artifact Pipeline

## 1. Summary

Stabilize the extracted Vite/React repository as the producer of one tested,
immutable static-site candidate. The repository will build `dist/`, add a
versioned `static-artifact-contract.json`, package the directory once as a
non-runnable OCI `static-site-bundle`, retain review artifacts for every CI run,
and publish the exact OCI layout to GHCR only after a successful push to
`main`.

This is a standard plan with design-review depth because it changes a public
delivery contract, CI permissions, and the handoff between application,
environment, and infrastructure repositories.

## 2. Goals

- Make the standalone repository's documented commands and CI independent of
  the former npm workspace and monorepo runbooks.
- Make `npm run check` prove type safety, frontend behavior, production build,
  and static-artifact contract generation.
- Define a versioned, machine-readable contract for the exact files in
  `dist/`, including sizes and SHA-256 digests.
- Preserve the production same-origin `/graphql` and diagnostic-header
  expectations required by the platform demo.
- Build the OCI representation once and promote the same bytes between CI jobs.
- Publish main-branch candidates to the GHCR repository already allowlisted by
  `movie-platform-environments`.
- Keep the implementation reviewable as small, ordered PR slices without
  committing or pushing during this task.

## 3. Non-goals

- Do not create or mutate S3, CloudFront, ECR, IAM, DNS, or other AWS resources.
- Do not deploy or promote an artifact to an environment.
- Do not edit release manifests in `movie-platform-environments` or consumers
  in `movie-platform-infra`.
- Do not add Playwright, Docker/Postgres orchestration, or a browser smoke job;
  frontend issue #2 owns that broader verification strategy.
- Do not delete or archive the golden-path source copy before standalone CI and
  the later AWS smoke gate pass.
- Do not turn the static site into a runnable frontend container.
- Do not change reservation UI, GraphQL schema, polling behavior, or backend
  behavior.
- Do not add a signing, SBOM, or attestation policy in this slice. The
  environment repository treats admission verification as a later boundary.

## 4. Baseline and Delivered State

The first four bullets describe repository behavior that predated this issue.
The remaining bullets record the implementation delivered by this plan and the
downstream boundaries that remain intentionally outside this repository.

- `.github/workflows/ci.yml` already runs on pull requests, pushes to `main`,
  and manual dispatch, using `.nvmrc`, `npm ci`, and `npm run check`.
- `package.json` is standalone and has no npm workspace dependency. Its current
  `check` command typechecks, tests, and builds.
- `vite.config.ts` uses the Vite proxy only for local `/graphql` development;
  `src/platform/api/graphql-client.ts` defaults browser requests to the same
  relative path in production.
- `src/platform/api/graphql-client.ts` emits `traceparent`,
  `X-Correlation-Id`, and `X-Request-Id`; existing Vitest coverage proves the
  request boundary.
- `README.md` now replaces monorepo-only runbook assumptions with standalone
  commands, documents the review artifact and immutable OCI candidate, and
  keeps the golden-path copy as a migration source until the stated handoff
  gates pass.
- `scripts/write-static-artifact-contract.mjs` now generates a deterministic,
  fail-closed contract for the built files, including `X-Request-Id` in the
  diagnostic header contract. Direct Vitest CLI coverage exercises successful
  generation and invalid build/provenance inputs.
- `.github/workflows/ci.yml` now packages the checked `dist/` directory as an
  OCI layout, uploads the exact layout for review, and promotes that tested
  layout to GHCR on `main` without rebuilding it.
- `movie-platform-environments/catalog/components.yaml` allowlists
  `ghcr.io/movie-reservation-platform-lab/movie-reservation-web` with artifact
  kind `static-site-bundle`. Its v1alpha1 release schema selects OCI artifacts
  by digest and records the source revision and producing build URL.
- `movie-platform-infra` owns eventual S3/CloudFront extraction, routing, cache
  headers, and deployment; it does not yet consume the web artifact.
- The local Programming KB's stable notes `Vite Production Builds`, `Static
  Frontend API Routing`, `Prefer CloudFront Same-Origin Routing for Static
  Frontend APIs`, and `Multi-Service Release Composition` support a static
  `dist/`, same-origin `/graphql`, build-once publication, and digest-based
  environment selection.

## 5. Requirements and Assumptions

### Confirmed Requirements

- Issue #4 requires standalone GitHub Actions verification, removal of
  monorepo-only runbook assumptions, a production static-artifact contract,
  and retention of the golden-path copy until CI and smoke gates pass.
- Root project guidance requires `npm run check` before handing off artifact
  changes and forbids infrastructure deployment from this repository.
- Source issue `golden-path-ecs-template#24` requires the standalone frontend
  typecheck, tests, build, and observability headers to remain intact.
- Source issue `golden-path-ecs-template#27` supplies later smoke and UX goals,
  while standalone frontend issue #2 now owns the browser/e2e strategy.
- The current environment catalog requires the production candidate to be a
  non-runnable OCI `static-site-bundle` in GHCR, not a container image or an
  expiring Actions artifact.
- The user explicitly requested implementation after planning and prohibited
  commits and pushes.

### Assumptions

- GHCR candidate publication on a push to `main` is part of the static-artifact
  pipeline; pull requests and manual runs produce review artifacts but do not
  mutate the package registry.
- The tag `sha-<full-commit>` is a discoverability/provenance hint only.
  Environment selection will use the immutable OCI digest reported by CI.
- Custom media types under `application/vnd.movie-platform.*` are acceptable
  for this internally owned contract.
- GitHub-hosted Actions runners and GitHub.com, rather than GHES, are the target
  CI environment.
- File mode preservation is not a deployment requirement because the Vite
  output contains static files, not executables.
- A JSON Schema can be added when a second independent consumer needs generated
  contract validation. For v1, an explicit versioned document plus CLI-level
  regression tests avoids a new validation dependency and two sources of
  truth.

### Open Questions

- What exact infra command will extract and upload the OCI directory layer?
  This does not change the producer format; it remains an infra-owned follow-up.
- When should provenance attestations and an SBOM become mandatory? The
  environment admission design calls for them later, but issue #4 does not
  define the policy or verifier.
- Which first successful CI run and AWS smoke evidence authorize deletion of
  the golden-path copy? Keep the copy until the owning follow-up records both.
- The new workflow cannot be proven on GitHub until the user pushes it. Local
  command, workflow-lint, and OCI-layout checks are the pre-push gate; the first
  real Actions run remains an explicit handoff step.

## 6. Proposed Design

### Build and contract flow

`npm run check` will run typecheck and Vitest, then call
`npm run build:static-artifact`. That command runs the normal TypeScript/Vite
build and writes `dist/static-artifact-contract.json`.

The checked-in `scripts/static-artifact-config.json` is the source of truth for
the artifact kind, registry, and OCI media types. The generator writes those
values into the v1 document, and CI reads them back from that document rather
than duplicating the contract. The generated v1 document will contain:

- artifact name, package version, `static-site-bundle` kind, root, and
  entrypoint;
- a stable, path-sorted file list with byte counts and SHA-256 hashes;
- source repository, full revision, source ref, build time, and optional
  Actions build URL;
- the review artifact name and OCI registry/repository/tag/media-type contract;
- S3/CloudFront ownership, SPA fallback, cache expectations, same-origin
  `/graphql`, optional build-time override, and all three propagated diagnostic
  headers.

The contract file excludes itself from the file digest list to avoid an
impossible self-referential checksum. The OCI manifest digest covers the whole
bundle, including the contract. Unsupported filesystem entries such as symlinks
will fail generation instead of being silently omitted from the manifest.

### CI data flow

```text
checkout -> npm ci -> npm run check -> dist/ + contract
                                    -> ORAS local OCI layout
                                    -> review artifact uploads
                                    -> main only: copy exact layout to GHCR
                                    -> resolve and compare published digest
```

The check job creates the OCI layout locally with ORAS and records its digest.
Both `dist/` and the content-addressed OCI layout are uploaded as immutable
workflow artifacts. The main-only publish job downloads the layout from the
same workflow run, authenticates with the scoped `GITHUB_TOKEN`, copies it to
GHCR without rebuilding, resolves the remote digest, and fails if it differs
from the check job's digest.

The workflow will pin every action to a full commit SHA with a release comment,
and install ORAS from a versioned URL with an explicit SHA-256 checksum. Npm
lifecycle scripts remain disabled because this frontend's dependencies do not
require them. The check job keeps `contents: read`; only the main-only publish
job receives `packages: write`.

### Ownership boundaries

- This repository owns source, tests, Vite build, the inner static contract,
  OCI candidate publication, and producing-build evidence.
- `movie-platform-environments` owns allowlisting and digest-based selection.
- Private admission automation will eventually verify provenance and copy the
  exact candidate to the trusted registry.
- `movie-platform-infra` owns extraction, S3/CloudFront configuration,
  deployment, cache headers, SPA fallback, and `/graphql` origin routing.

## 7. Alternatives Considered

### Alternative A: Keep only a GitHub Actions workflow artifact

- Pros: Minimal workflow and easy human download.
- Cons: Retention-limited, Actions-specific, and not addressable by the OCI
  digest required by the environment release contract.
- Decision: Retain it as review evidence, reject it as the production candidate.

### Alternative B: Package the frontend as a runnable or scratch container image

- Pros: Familiar Docker/buildx workflow and easy GHCR publication.
- Cons: Blurs `static-site-bundle` with `container-image`, adds image config and
  extraction ambiguity, and encourages runtime ownership in the frontend repo.
- Decision: Rejected because the platform explicitly deploys static files to
  S3/CloudFront.

### Alternative C: Rebuild `dist/` in a separate publication job

- Pros: Simple job isolation; no intermediate layout upload.
- Cons: The published artifact is only similar to the tested one. Dynamic build
  metadata or tool drift can change its digest.
- Decision: Rejected. Build and package once, then copy the same content-addressed
  OCI layout.

### Alternative D: Build one ORAS directory artifact and retain a review copy

- Pros: Matches the environment catalog, preserves static semantics, produces
  an immutable digest, supports local OCI-layout verification, and separates
  review retention from production distribution.
- Cons: Adds the ORAS CLI/action and custom media types; downstream extraction
  must understand the directory layer.
- Decision: Recommended as the smallest design aligned with the current
  cross-repository contract.

## 8. API / Interface Changes

- Add/retain package scripts:
  - `artifact:contract`: write the v1 inner manifest into an existing `dist/`.
  - `build:static-artifact`: build and then write the contract.
  - `check`: typecheck, test, and produce the complete static artifact.
- Add the public build output `dist/static-artifact-contract.json` with
  `schemaVersion: 1`.
- Publish the OCI artifact type
  `application/vnd.movie-platform.static-site.v1` with directory layer media
  type `application/vnd.movie-platform.static-site.layer.v1.tar`.
- Publish candidate tag `ghcr.io/<github.repository>:sha-<full-sha>` on main;
  the immutable digest remains the deployment selector.
- Preserve frontend runtime behavior: `/graphql` by default and
  `VITE_GRAPHQL_URL` as a browser-visible build-time override.
- No GraphQL, route, DOM, or TypeScript application API changes.

## 9. Data Model / Persistence Changes

None. The generated contract and OCI layout are immutable build outputs. No
database, migration, backfill, or retained application state is introduced.

## 10. Security, Privacy, and Abuse Considerations

- Keep default workflow permission at `contents: read`; grant
  `packages: write` only to the main-only publication job.
- Use the repository-scoped `GITHUB_TOKEN`; add no PAT, AWS credential, secret,
  or production configuration.
- Treat `ghcr.io` as a fixed credential boundary in the privileged publish job;
  validate the descriptive contract registry before passing the token to ORAS.
- Pin action implementations by full commit SHA and install ORAS from a
  versioned URL with an explicit SHA-256 checksum.
- Disable dependency lifecycle scripts in CI; add any future required
  lifecycle operation as an explicit reviewed step.
- Do not publish on pull requests, including forks, so untrusted code cannot
  receive package mutation authority.
- Do not include rendered env files, tokens, source maps outside Vite's normal
  output, or arbitrary workspace files; only `dist/` is packaged.
- Fail on symlinks and non-regular output entries so the checksum inventory and
  packaged bytes cannot silently diverge.
- Treat tags, refs, versions, and build URLs as provenance/human hints. Only the
  resolved SHA-256 OCI digest selects deployable bytes.
- `VITE_*` remains browser-visible; production secrets are out of scope and
  must not be added to the bundle.
- The inner checksum list detects extraction corruption; future admission must
  still verify registry identity, source, attestation, and trust policy.

## 11. Performance, Scalability, and Reliability Considerations

- The Vite bundle is small, and hashing is linear in output bytes. Read files
  concurrently within each directory and sort only the resulting path list.
- A single OCI directory layer keeps the consumer extraction contract simple.
- Build once avoids divergent candidate bytes and reduces duplicate Node/Vite
  work in the publication job.
- GitHub workflow artifacts remain a short-lived review/retry bridge; GHCR is
  the durable candidate registry.
- Main-branch concurrency may cancel a superseded in-progress candidate. The
  later commit still publishes independently; no mutable `latest` tag is used.
- Missing `index.html`, malformed source epoch, unsupported filesystem entries,
  missing ORAS digest output, or remote/local digest mismatch fail explicitly.
- Cache expectations distinguish mutable entrypoints/contracts from hashed
  immutable assets, but infra remains responsible for applying headers.

## 12. Implementation Steps

The steps are also the recommended small-PR sequence. No commits or PRs will be
created during this task; the file groups make later manual splitting explicit.

1. PR 1 - Add the tested static-artifact contract
   - Change: Harden the generator, complete v1 provenance/distribution/runtime
     fields, fail closed on unsupported output entries, and add CLI-level
     Vitest regression coverage using isolated temporary fixture repositories.
   - Files/modules likely affected:
     `scripts/static-artifact-config.json`,
     `scripts/write-static-artifact-contract.mjs`,
     `scripts/write-static-artifact-contract.test.mjs`, `package.json`.
   - Notes: Do not add a JSON Schema dependency in v1. Exercise the public Node
     command and emitted JSON rather than private helper implementation.
   - Verification: focused Vitest file; missing entrypoint, deterministic
     metadata/checksums, stale contract exclusion, required headers, invalid
     epoch, and unsupported entry tests.

2. PR 2 - Wire build-once CI and OCI publication
   - Change: Make `npm run check` produce the complete static artifact; create
     and verify a local OCI layout; upload `dist/` and the layout for each CI
     run; copy the exact layout to GHCR only on main; compare local and remote
     OCI digests.
   - Files/modules likely affected: `.github/workflows/ci.yml`, `package.json`.
   - Notes: Pin action SHAs and checksum-pin ORAS 1.3.3. Run
     `npm ci --ignore-scripts`; keep package write permission off pull-request
     jobs. Do not rebuild in the publish job. Read artifact names/media types
     from the generated contract.
   - Verification: `npm run check`, local ORAS OCI-layout build/manifest query,
     workflow lint, and later the first pushed GitHub Actions run.

3. PR 3 - Finalize standalone runbooks and ownership handoff
   - Change: Remove stale monorepo-owned paths, document local commands, review
     artifacts, GHCR candidate/tag/digest semantics, downstream ownership,
     verification, rollback, and the golden-path retention gate.
   - Files/modules likely affected: `README.md`, this plan.
   - Notes: Link to owning repositories/issues instead of copying their future
     deployment procedures here.
   - Verification: commands and names match `package.json` and the workflow;
     repository search finds no stale local path or workspace command.

4. Cross-cutting review and remediation
   - Change: Ask system-design, security, and readability/maintainability review
     agents for findings with file/line evidence, then address substantiated
     issues without broadening scope.
   - Files/modules likely affected: only files from PRs 1-3.
   - Notes: Performance review is optional because output size and algorithms
     are bounded; include it only if another review identifies a scaling risk.
   - Verification: rerun focused tests, `npm run check`, workflow lint, local OCI
     verification, and `git diff --check` after fixes.

## 13. Testing Strategy

### Unit and CLI contract tests

- Execute a copied generator through Node in an isolated temporary repository.
- Assert a missing `dist/index.html` fails with an actionable message.
- Assert fixed `SOURCE_DATE_EPOCH` and GitHub environment values produce stable
  provenance, build URL, upload name, and OCI metadata.
- Assert nested files are sorted and contain exact byte lengths/SHA-256 hashes.
- Assert an existing contract is excluded, so reruns are idempotent.
- Assert the deployment contract includes `/graphql`, cache expectations, and
  `traceparent`, `X-Correlation-Id`, and `X-Request-Id`.
- Assert invalid source epochs and unsupported filesystem entries fail closed.
- Assert missing Git provenance fails instead of emitting a degraded
  `"unknown"` source revision.

### Existing regression coverage

- Run all current Vitest suites for domain behavior, polling cancellation and
  stale work, parsers, GraphQL error mapping, and observability propagation.
- Run TypeScript typecheck and the Vite production build.

### Artifact/contract integration

- Run `npm run build:static-artifact` and inspect the real generated contract.
- Independently hash listed files and ensure no non-contract regular file is
  omitted.
- Use pinned ORAS to create a local OCI layout with the workflow's exact media
  types and inspect its manifest/digest without registry credentials.

### CI workflow verification

- Run `actionlint` against `.github/workflows/ci.yml`.
- Verify PR/manual events have no registry mutation step.
- Verify only the main publish job has `packages: write`.
- After the user pushes, require a green GitHub Actions run, a downloadable
  review artifact, a published GHCR digest equal to the check job's digest, and
  a useful step summary.

### Deferred tests

- Playwright browser workflow, responsive/accessibility verification, and
  report/trace retention remain in frontend issue #2.
- Same-origin CloudFront `/graphql` routing and AWS smoke checks require the
  future infra consumer and are not faked in this repository.

## 14. Rollout / Migration Plan

1. Review/merge PR 1 so the static contract and tests exist independently.
2. Review/merge PR 2; its pull-request run proves build/layout generation but
   cannot publish.
3. On the first `main` run, verify the review artifact, OCI digest comparison,
   GHCR package association/visibility, and step summary.
4. Review/merge PR 3 or fold its documentation into PR 2 if a separate docs PR
   would add review overhead without reducing risk.
5. In a later environment/infra change, select the GHCR candidate by digest,
   admit/copy exact bytes, extract `dist/`, deploy to S3/CloudFront, and run the
   real same-origin reservation smoke test.
6. Keep the golden-path frontend copy until standalone CI and that AWS smoke
   evidence are recorded.

Rollback before publication is a normal code revert. After a candidate is
published, never mutate or delete its SHA tag as rollback. Revert the workflow
for future candidates and have environment control reselect the previous known
OCI digest. No database or infrastructure rollback is owned here.

## 15. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---:|---:|---|
| Tested and published bytes diverge | High | Medium | Build one OCI layout in the check job, copy it unchanged, and compare remote/local digests. |
| An untrusted PR gains registry write access | High | Low | Main-only publish job with job-scoped `packages: write`; PR check remains read-only. |
| Static bundle is mistaken for a runnable image | Medium | Medium | Use `static-site-bundle`, custom artifact/layer media types, ORAS, and no Dockerfile/runtime config. |
| Contract inventory omits packaged content | High | Low | Package only `dist/`; recurse deterministically; fail on unsupported entries; regression-test nested files and stale contracts. |
| Self-checksum creates an unstable manifest | Medium | High without design | Exclude the inner contract from its file list; rely on the outer OCI digest to cover it. |
| Main publication cannot be fully tested locally | Medium | Medium | Build/inspect an OCI layout locally and lint workflow; reserve GHCR mutation and real Actions proof for the first user-pushed run. |
| Action or CLI supply chain is mutable | High | Low | Pin action commits and the ORAS release checksum; disable npm lifecycle scripts; use only the scoped GitHub token. |
| Expiring workflow artifact is treated as release identity | High | Medium | Document workflow artifacts as review evidence and OCI digest as the environment selector. |
| Cache policy is applied incorrectly downstream | Medium | Medium | Declare expectations in the contract and leave implementation/testing with infra; do not claim deployment success here. |
| Golden-path copy is removed prematurely | Medium | Low | Retain it until both standalone CI and AWS smoke evidence pass. |
| Existing unrelated working-tree edits are overwritten | High | Low | Patch only issue-owned files and preserve all pre-existing uncommitted changes. |

## 16. Done Criteria

- [ ] The implementation plan is stored under `docs/plans/` and reflects the
      source backlog, current repository, KB guidance, and downstream contracts.
- [ ] `npm run check` passes and leaves a complete `dist/` containing
      `index.html`, hashed Vite assets, and `static-artifact-contract.json`.
- [ ] CLI-level tests cover contract success, determinism, failure modes,
      integrity metadata, API routing, and diagnostic headers.
- [ ] The generated contract declares all three propagated headers, including
      `X-Request-Id`.
- [ ] CI uploads review artifacts on PR, main, and manual runs.
- [ ] CI constructs one OCI layout and the publish job does not rebuild it.
- [ ] Registry publication can run only for pushes to `main` and only that job
      has `packages: write`.
- [ ] The published reference uses `sha-<full-sha>`, reports the immutable OCI
      digest, and verifies the remote digest equals the check job digest.
- [ ] Actions are pinned by full commit SHA and ORAS is pinned by versioned URL
      plus SHA-256 checksum.
- [ ] README contains no repository-local monorepo runbook assumption and
      documents producer/environment/infra ownership accurately.
- [ ] `git diff --check`, workflow lint, local OCI inspection, focused tests,
      and `npm run check` pass.
- [ ] Review agents report no unresolved high/medium findings in the changed
      files.
- [ ] No commit, push, PR, deployment, promotion, or shared environment mutation
      was performed.
- [ ] First real GitHub Actions run and AWS smoke verification are explicitly
      handed off rather than claimed locally.

## 17. Review Checklist

- [x] Requirements are explicit
- [x] Non-goals are explicit
- [x] Existing code conventions were checked
- [x] Alternatives were considered
- [x] Security implications were reviewed
- [x] Scalability and reliability implications were reviewed
- [x] Testing strategy is complete
- [x] Rollout and rollback are defined
- [x] Implementation steps are ordered and concrete

## 18. Handoff Prompt for Implementation Agent

```text
Implement the plan in docs/plans/issue-4-standalone-static-artifact-pipeline.md.

Constraints:
- Stay within the scope of the plan.
- Do not introduce new npm dependencies.
- Preserve existing frontend and GraphQL behavior.
- Preserve all pre-existing uncommitted changes; do not reset or revert them.
- Build the static artifact and OCI layout once, then publish the same layout.
- Keep registry write permission in the main-only job.
- Do not add AWS resources, deploy, promote, commit, push, or open PRs.
- Update tests and docs described in the plan.
- If implementation reality differs from the plan, stop and update the plan or
  ask for approval before changing scope.

Relevant files/modules:
- package.json
- scripts/static-artifact-config.json
- scripts/write-static-artifact-contract.mjs
- scripts/write-static-artifact-contract.test.mjs
- .github/workflows/ci.yml
- README.md
- docs/plans/issue-4-standalone-static-artifact-pipeline.md

Expected verification commands:
- npx vitest run scripts/write-static-artifact-contract.test.mjs
- npm run check
- actionlint .github/workflows/ci.yml
- ORAS local OCI-layout push and manifest inspection from the plan
- git diff --check
```
