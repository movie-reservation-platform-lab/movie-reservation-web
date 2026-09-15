import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const packageManifest = JSON.parse(readFileSync("package.json", "utf8"));
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const sharedActionsRevision = "036531133bcefd454b5afc0eb55f8ba0328901ea";
const scannerStepName = "Evaluate complete report with current approved policy";
const diagnosticUploadStepName = "Retain PR vulnerability diagnostics";

describe("repository and CI automation contract", () => {
  it("keeps frontend and automation tests in distinct discovery paths", () => {
    const frontendConfig = readFileSync("vitest.config.ts", "utf8");
    const automationConfig = readFileSync("automation/vitest.config.ts", "utf8");

    expect(packageManifest.scripts["test:web"]).toBe(
      "vitest run --config vitest.config.ts",
    );
    expect(packageManifest.scripts["test:automation"]).toBe(
      "vitest run --config automation/vitest.config.ts",
    );
    expect(frontendConfig).toContain('include: ["src/**/*.test.{ts,tsx}"]');
    expect(frontendConfig).not.toContain("automation/");
    expect(automationConfig).toContain(
      'include: ["automation/**/*.test.mjs"]',
    );
    expect(automationConfig).not.toContain("src/**/*.test.ts");
  });

  it("runs automation separately and gates main publication on both jobs", () => {
    const checkJob = readWorkflowJob("check");
    const automationJob = readWorkflowJob("automation-quality");
    const publishJob = readWorkflowJob("publish-static-artifact");

    expect(checkJob).toContain("run: npm run check:web");
    expect(checkJob).not.toContain("run: npm run test:automation");
    expect(automationJob).toContain("run: npm run test:automation");
    expect(automationJob).not.toContain("run: npm run check:web");
    expect(publishJob).toContain("- automation-quality");
    expect(publishJob).toContain("- check");
    expect(publishJob.match(/^    if: (.+)$/m)?.[1]).toBe(
      "github.event_name == 'push' && github.ref == 'refs/heads/main' && github.repository == 'movie-reservation-platform-lab/movie-reservation-web'",
    );
    expect(publishJob.match(/^    permissions:\n((?:      .+\n)+)/m)?.[1]).toBe(
      "      actions: read\n      contents: read\n      packages: write\n",
    );
    expect(publishJob).not.toMatch(
      /prepare-container-candidate@|\/actions\/container-evidence@|id-token:|attestations:/,
    );
    expect(workflow).not.toContain("pull_request_target:");
  });

  it("keeps the temporary ECS image gated and single-manifest compatible", () => {
    const smokeJob = readWorkflowJob("container-smoke");
    const publishJob = readWorkflowJob("publish-ecs-image");

    expect(smokeJob).toContain("load: true");
    expect(smokeJob).toContain("provenance: false");
    expect(smokeJob).toContain("platforms: linux/amd64");
    expect(smokeJob).toContain("target: prod");
    expect(smokeJob).not.toContain("packages: write");
    expect(publishJob.match(/^    if: (.+)$/m)?.[1]).toBe(
      "github.event_name == 'push' && github.ref == 'refs/heads/main' && github.repository == 'movie-reservation-platform-lab/movie-reservation-web'",
    );
    expect(publishJob).toContain("- automation-quality");
    expect(publishJob).toContain("- check");
    expect(publishJob).toContain("- container-smoke");
    expect(publishJob).toContain("- container-security-check");
    expect(publishJob).not.toMatch(/always\(\)|continue-on-error/);
    expect(publishJob).toContain("platforms: linux/amd64");
    expect(publishJob).toContain("target: prod");
    expect(publishJob).toContain("provenance: false");
    expect(publishJob.match(/^    permissions:\n((?:      .+\n)+)/m)?.[1]).toBe(
      "      contents: read\n      packages: write\n      id-token: write\n      attestations: write\n",
    );
    expect(publishJob).toContain(
      "tags: ${{ steps.candidate.outputs.image_ref }}:${{ steps.candidate.outputs.tag }}",
    );
  });

  it("pins every external action to a full commit SHA", () => {
    const actionReferences = [...workflow.matchAll(/^\s+uses:\s+(\S+)/gm)].map(
      (match) => match[1],
    );

    expect(actionReferences.length).toBeGreaterThan(0);
    for (const actionReference of actionReferences) {
      expect(actionReference).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
    }
  });
});

it("selects reviewed v1alpha3 evidence for the exact published ECS digest", () => {
  const publishJob = readWorkflowJob("publish-ecs-image");
  const staticJob = readWorkflowJob("publish-static-artifact");
  expect(publishJob).toContain(
    "github.repository == 'movie-reservation-platform-lab/movie-reservation-web'",
  );
  expect(publishJob).toContain("component: reservation-web");
  expect(publishJob).toContain("digest: ${{ steps.publish.outputs.digest }}");
  expect(publishJob).toContain("attestations: write");
  expect(publishJob).toContain("id-token: write");
  expect(publishJob).toContain("evidence-version: v1alpha3");
  expect(publishJob).toContain("node-version: '24'");
  expect(publishJob).not.toMatch(/npm (?:ci|install)|continue-on-error/);
  expect(publishJob).toContain("name: publish temporary ECS image");
  expect(staticJob).not.toContain("/actions/container-evidence@");
  expect(staticJob).not.toMatch(/container-security-check|id-token:|attestations:/);
  expect(workflow).toContain(
    "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
  );
  expectStepBefore(
    publishJob, "Prepare canonical candidate", "Log in to GitHub Container Registry",
  );
  expectStepBefore(
    publishJob, "Publish temporary ECS image", "Attest and publish security evidence",
  );

  const sharedActionReferences = publishJob.matchAll(
    /movie-reservation-platform-lab\/movie-platform-actions\/actions\/[^@]+@([a-f0-9]{40})/g,
  );
  const actionPins = [...sharedActionReferences].map((match) => match[1]);
  expect(actionPins).toEqual([sharedActionsRevision, sharedActionsRevision]);

  const prepareStep = readWorkflowStep(publishJob, "Prepare canonical candidate");
  expect(prepareStep).toContain(
    `uses: movie-reservation-platform-lab/movie-platform-actions/actions/prepare-container-candidate@${sharedActionsRevision}`,
  );
  expect(prepareStep).toContain(
    "        with:\n          component: reservation-web\n          github-token: ${{ github.token }}\n",
  );

  const evidenceStep = readWorkflowStep(
    publishJob,
    "Attest and publish security evidence",
  );
  expect(evidenceStep).toContain(
    `uses: movie-reservation-platform-lab/movie-platform-actions/actions/container-evidence@${sharedActionsRevision}`,
  );
  expect(evidenceStep).toContain(
    "        with:\n          evidence-version: v1alpha3\n          component: reservation-web\n          digest: ${{ steps.publish.outputs.digest }}\n          github-token: ${{ github.token }}\n",
  );
  expect(workflow).not.toMatch(
    /actions\/create-github-app-token|EVIDENCE_READER_APP_|EXEMPTION_POLICY_READER_APP_/,
  );
});

describe("container vulnerability gate", () => {
  const security = readWorkflowJob("container-security-check");

  it("runs on PRs, main pushes and manual runs without skipping main's dependency", () => {
    const triggers = workflow.slice(
      workflow.indexOf("on:\n"),
      workflow.indexOf("\npermissions:"),
    );
    expect(triggers).toBe(
      "on:\n  pull_request:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n",
    );
    expect(security).not.toMatch(/^    (?:if|needs):/m);
    expect(workflow).not.toMatch(/pull_request_target:|workflow_run:/);
    expect(security).toContain("timeout-minutes: 20");
  });

  it("has only read authority and cannot publish, attest or persist credentials", () => {
    const permissions = security.match(/^    permissions:\n((?:      .+\n)+)/m)?.[1];
    expect(permissions).toBe("      contents: read\n");
    expect(security).not.toMatch(
      /packages:|id-token:|attestations:|secrets\.|push: true|login-action|\/actions\/container-evidence@|prepare-container-candidate@/,
    );
    const checkouts = readWorkflowSteps(security).filter((step) =>
      step.includes("uses: actions/checkout@"),
    );
    expect(checkouts).toHaveLength(2);
    for (const checkout of checkouts) {
      expect(checkout).toContain("persist-credentials: false");
    }
    expect(security).toContain("GH_TOKEN: ${{ github.token }}");
  });

  it("uses the reviewed shared scanner on this producer's amd64 production image", () => {
    expect(security).toContain(
      "repository: movie-reservation-platform-lab/movie-platform-actions",
    );
    expect(security).toContain(`ref: ${sharedActionsRevision}`);
    expect(security).toContain("path: .platform-actions");
    expect(security).toContain("node-version: '24'");
    expect(security).toContain(
      "docker build --pull --platform linux/amd64 --target prod --tag movie-reservation-web:pr-security .",
    );
    const scan = readWorkflowStep(security, scannerStepName);
    expect(scan).toContain(
      "node .platform-actions/local-tools/container-security/lib/scan.mjs",
    );
    expect(scan).toContain("movie-reservation-web:pr-security");
    expect(scan).toContain("--evidence-version v1alpha3 --component reservation-web");
    expect(scan).not.toMatch(
      /--severity|--ignore|TRIVY_|policy-file|policy-revision|continue-on-error/,
    );
    expect(readFileSync(".dockerignore", "utf8")).toMatch(/^\.platform-actions$/m);
  });

  it.each([
    { outcome: "accepted", exitCode: 0 },
    { outcome: "policy rejected", exitCode: 1 },
    { outcome: "operational failure", exitCode: 2 },
  ])("propagates $outcome (exit $exitCode) to the runner", ({ exitCode }) => {
    const command = readStepShellCommand(security, scannerStepName);
    // Exercise the actual workflow shell with a command-boundary double. Exit 1
    // is policy rejection, 2 is scanner/report/policy acquisition failure.
    const result = spawnSync(
      "bash",
      [
        "--noprofile", "--norc", "-e", "-o", "pipefail", "-c",
        `node() { return ${exitCode}; }\n${command}`,
      ],
      { encoding: "utf8", env: { ...process.env, RUNNER_TEMP: "/tmp" } },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(exitCode);
    expect(security).not.toContain("continue-on-error:");
  });

  it("retains the entire diagnostics directory after scan or policy failure", () => {
    const upload = readWorkflowStep(security, diagnosticUploadStepName);
    // Explicit status function avoids GitHub's implicit success() condition.
    expect(upload).toContain("if: ${{ !cancelled() }}");
    expect(upload).toContain("uses: actions/upload-artifact@");
    expect(upload).toContain(
      "name: reservation-web-pr-vulnerability-report-${{ github.run_id }}-attempt-${{ github.run_attempt }}",
    );
    expect(upload).toContain("path: ${{ runner.temp }}/reservation-web-pr-security/\n");
    expect(upload).toContain("if-no-files-found: error");
    expect(upload).toContain("retention-days: 14");
    expect(security).toContain('--output-dir "$RUNNER_TEMP/reservation-web-pr-security"');
    expectStepBefore(security, scannerStepName, diagnosticUploadStepName);
    expect(security).not.toMatch(/\brm\s|\bfind\s.*delete/);
  });
});

it("tracks canonical AI guidance and ignores generated assistant and scan folders", () => {
  const ignoredFolders = [
    ".claude", ".codex", ".cursor", ".gemini", ".roo",
    ".platform-actions", ".local-container-security", "security-evidence",
  ];
  const probePaths = ignoredFolders.map((folder) => `${folder}/probe`);
  const result = spawnSync(
    "git",
    ["check-ignore", "--no-index", ...probePaths],
    { encoding: "utf8" },
  );
  expect(result.status).toBe(0);
  expect(result.stdout.trim().split("\n")).toEqual(probePaths);
  const canonicalGuidance = spawnSync("git", [
    "check-ignore", "--no-index", ".ai/project-guidance.md", "AGENTS.md",
  ]);
  expect(canonicalGuidance.status).toBe(1);
});

it("reports missing workflow blocks instead of treating them as ordered steps", () => {
  const security = readWorkflowJob("container-security-check");
  expect(() => readWorkflowJob("missing-job")).toThrow("Missing workflow job");
  expect(() => expectStepBefore(security, "missing-step", diagnosticUploadStepName))
    .toThrow("Missing workflow step");
  expect(() => readStepShellCommand(security, diagnosticUploadStepName))
    .toThrow("Missing multiline shell command");
});

// These readers inspect this repository's two-space-indented workflow source,
// not arbitrary YAML. Keep raw GitHub expressions intact for contract assertions.
function readWorkflowJob(jobName) {
  const lines = workflow.split("\n");
  const jobStart = lines.findIndex((line) => line === `  ${jobName}:`);
  expect(jobStart, `Missing workflow job ${jobName}`).toBeGreaterThanOrEqual(0);
  const nextJob = lines.findIndex(
    (line, index) => index > jobStart && /^  [a-z0-9-]+:$/.test(line),
  );
  return lines.slice(jobStart, nextJob === -1 ? undefined : nextJob).join("\n");
}

function readWorkflowSteps(job) {
  return job.split(/(?=^      - name: )/m).slice(1);
}

function readWorkflowStep(job, stepName) {
  const step = readWorkflowSteps(job).find((source) =>
    source.startsWith(`      - name: ${stepName}\n`),
  );
  expect(step, `Missing workflow step ${stepName}`).toBeDefined();
  return step;
}

function readStepShellCommand(job, stepName) {
  const step = readWorkflowStep(job, stepName);
  const command = step.split("        run: |\n")[1];
  expect(command, `Missing multiline shell command in ${stepName}`).toBeDefined();
  return command
    .split("\n")
    .map((line) => line.replace(/^          /, ""))
    .join("\n");
}

function expectStepBefore(job, earlierStepName, laterStepName) {
  // Check existence first: indexOf(missing) === -1 must not count as "before".
  const earlierStep = readWorkflowStep(job, earlierStepName);
  const laterStep = readWorkflowStep(job, laterStepName);
  expect(job.indexOf(earlierStep)).toBeLessThan(job.indexOf(laterStep));
}
