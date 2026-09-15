# Container security checks and v1alpha3 evidence

Tracking: [reservation-web #17](https://github.com/movie-reservation-platform-lab/movie-reservation-web/issues/17).
This follows successful merged PR #16 and changes only the temporary ECS image
security path. Static-site OCI publication retains its separate contract.

## Workflow boundaries

| Path | Permissions | Result |
| --- | --- | --- |
| PR/main/manual container-security-check | contents:read | Local image report and current policy diagnostic; no publish/attest capability |
| Canonical main publish-ecs-image | contents:read, packages:write, id-token:write, attestations:write | Exact published digest scan and signed v1alpha3 four-file evidence |
| publish-static-artifact | Existing independent permissions/dependencies | Tested static-site OCI layout; no container evidence/admission changes |

The security job builds `Dockerfile` target `prod` for `linux/amd64`. It invokes
the reviewed shared scanner under Node 24 with `--evidence-version v1alpha3
--component reservation-web`. Its `GH_TOKEN` is the job's read-only GitHub token,
used to read central approved policy. Checkouts do not persist credentials.
ECS publication requires check, automation-quality, container-smoke and
container-security-check success. Its existing profile-bound job ID/display
name and push/main/canonical-repository guard remain intact.

Both shared actions and the scanner checkout pin
`036531133bcefd454b5afc0eb55f8ba0328901ea`. Prepare receives the publishing
job's token explicitly for its authenticated exact-main lookup; its job retains
the existing `contents: read`, package, OIDC and attestation permissions. The
implementation pin does not freeze approved policy: the helper resolves central
main once per decision and records that source revision. Failed or incomplete
policy acquisition fails closed. This shared release also bounds legacy evidence
reads, sanitizes failure output and reports scanner cleanup failures.

## Retention and failure behavior

The shared isolated Trivy 0.70.0 image is pinned at
`sha256:be1190afcb28352bfddc4ddeb71470835d16462af68d310f9f4bca710961a41e`.
It includes UNKNOWN, LOW, MEDIUM, HIGH, CRITICAL and unfixed findings without
producer ignore/config/VEX overrides. This avoids the suppression mechanisms
described in [Trivy's filtering documentation](https://trivy.dev/docs/latest/configuration/filtering/).

The scanner exits 0 for an accepted policy result, 1 for policy rejection and 2
for an operational/report/policy failure. CI propagates that status without
continue-on-error. The upload's explicit `!cancelled()` condition still runs after
failure and preserves the whole fresh run directory, including:

- `vulnerabilities.json`, `vulnerability-policy.json`, `summary.txt` after evaluation;
- `report.partial.json` and `vulnerability-policy-error.txt` when available on failure.

An incomplete scan cannot provide a complete report; retained partial bytes are
diagnostics only. No files is an upload error. Artifacts use
`reservation-web-pr-vulnerability-report-<run-id>-attempt-<attempt>` and expire
after 14 days (the PR name also covers main/manual diagnostic runs).

The canonical shared action separately scans the published manifest digest,
verifies provenance and signs exactly the v3 candidate document, image provenance,
CycloneDX SBOM and vulnerability report. Its failure path retains available SBOM,
complete report and policy diagnostic under a rejected-security-evidence name.
Policy acquisition errors retain available reports and runner logs; a policy
diagnostic JSON exists only when evaluation has returned a decision.
Neither local/PR reports nor rejected artifacts authorize publication, admission
or deployment. Successful checks of a local rebuild do not prove the later
published digest; canonical publication performs its own scan.

## Local reproduction

Requires Node 24, Docker's local Unix socket and GitHub read access to central
policy. Use an existing reviewed actions checkout or create one outside this repo:

```sh
git clone https://github.com/movie-reservation-platform-lab/movie-platform-actions.git /tmp/reservation-web-actions
git -C /tmp/reservation-web-actions checkout --detach 036531133bcefd454b5afc0eb55f8ba0328901ea
npm ci --ignore-scripts
npm run check
docker build --pull --platform linux/amd64 --provenance=false --target prod --tag movie-reservation-web:v1alpha3 .
GH_TOKEN="$(gh auth token)" node /tmp/reservation-web-actions/local-tools/container-security/lib/scan.mjs \
  movie-reservation-web:v1alpha3 --evidence-version v1alpha3 --component reservation-web
```

Do not echo the token or enable shell tracing. The helper writes fresh run
directories under ignored `.local-container-security/`. The shared checkout and
diagnostics are excluded from Docker context. Smoke-test the image's `/health`,
root HTML and non-root user as CI does; stop/remove only the test container.

## Remediation and observed verification

2026-09-15 baseline, pulled original `1.29-alpine` image: Alpine 3.23.4;
UNKNOWN 6, LOW 37, MEDIUM 86, HIGH 35, CRITICAL 0. Policy passed without exemptions,
but 164 findings required remediation. Affected runtime packages included c-ares,
curl/libcurl, OpenSSL libraries, libexpat, libpng, libuuid and libxml2.

Updated the runtime to `nginxinc/nginx-unprivileged:1.30.4-alpine` pinned at
`sha256:adf5042a17f4ecdd200c595fa9ffd1be37efb18f89a830bd1a00e4ab4d59d42c`
(Alpine 3.24.1). Its production-image scan found zero vulnerabilities at every
severity, with policy `passed`, no exemptions and no warnings. The Node build
stage and its npm packages are absent from the Nginx runtime. Separately, targeted
lockfile updates moved Vitest and its coordinated packages 4.1.10 → 4.1.11 and
nanoid 3.3.17 → 3.3.19; npm audit then reported zero vulnerabilities. No MCP/Python
package changes, vulnerability ignores or new approvals were used.

Final verification at `2026-09-15T08:42:57Z`:

- `npm run check`: passed; 99 frontend tests, 22 automation tests, typecheck and
  static-artifact build/contract generation.
- Production `linux/amd64` image built with default Dockerfile arguments and
  `--provenance=false`; local image/manifest ID
  `sha256:6cfdb473c082600e048ee1809fef8b91372f171a6668ffed4dc3937937a9f862`.
- HTTP `/health` returned `status:ok`, root HTML contained the React mount,
  runtime UID was 101, `nginx -t` passed, and Node/node_modules were absent.
- Shared scanner exit 0; all five severity counts 0, result `passed`, 0 exemptions,
  0 blocking CRITICAL and no warnings. Resolved policy revision:
  `bb40579c285df0b581c48b10f9b34574d5c78639`.
- Full report SHA-256:
  `a3d8dd8b77b1c31d219c3e573d70e4afaa1d5b32b150463ace35241c4382e164`.
  Local report/decision/summary retained under
  `.local-container-security/run-8m0mDl/`; baseline under `run-XrDpX9/`.
- `git diff --check` and AI shell-script syntax checks passed. Reviewed the diff
  and included canonical AI files for credential patterns and unrelated changes.
- Independent read-only security review: no material findings. Hosted token
  access and canonical signing still require their respective hosted runs.

These identifiers describe local diagnostics, not a GHCR-published candidate.
Canonical OIDC attestations and exact-published-digest scans require a future
successful canonical main run; no publication/admission workflow was dispatched.

## Cross-repository dependencies

- [movie-platform-actions #14](https://github.com/movie-reservation-platform-lab/movie-platform-actions/issues/14)
  and [#18](https://github.com/movie-reservation-platform-lab/movie-platform-actions/pull/18):
  authenticated prepare plus bounded evidence failure paths and scanner cleanup,
  merged at the current exact pin above.
- [recommendation-MCP #13](https://github.com/movie-reservation-platform-lab/movie-recommendation-mcp/pull/13):
  publication-and-admission canary for this caller migration; it does not prove
  application deployment or universal private-repository compatibility.
- [recommendation-MCP #11](https://github.com/movie-reservation-platform-lab/movie-recommendation-mcp/pull/11) and [reservation-MCP #9](https://github.com/movie-reservation-platform-lab/movie-reservation-mcp/pull/9): merged reference implementations. This producer runs its security job on main too so canonical publication can depend on it.
- [environments #82](https://github.com/movie-reservation-platform-lab/movie-platform-environments/issues/82): tracks runnable-component admission. [#93](https://github.com/movie-reservation-platform-lab/movie-platform-environments/pull/93) and [#95](https://github.com/movie-reservation-platform-lab/movie-platform-environments/pull/95) are merged policy-reader and diagnostic support. Hosted v3 admission activation/selection remains environment-owned and must be verified there; this PR dispatches no workflows and changes no environment state.

Planning used the local Programming KB note `concepts/Environment Release
Manifest.md`: immutable candidate creation and environment selection are separate
responsibilities. The frontend architecture review keeps this work in CI/container
adapters, with no changes to feature domain/application/UI code.

The authenticated-prepare migration is verified offline and by ordinary PR CI.
Because ECS publication remains restricted to canonical `main` pushes, PR checks
cannot exercise prepare or publish evidence. After merge, acceptance must select
a new successful canonical run and separately admit that exact run; historical
producer run IDs must not be reused. Rollback reverts the three coordinated pins
and prepare token input together, with matching current tests and documentation.
