import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const packageManifest = JSON.parse(readFileSync("package.json", "utf8"));
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const sharedRevision = "bb40579c285df0b581c48b10f9b34574d5c78639";

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
    expect(publishJob).toContain("packages: write");
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
    expect(publishJob).toContain("github.event_name == 'push'");
    expect(publishJob).toContain("github.ref == 'refs/heads/main'");
    expect(publishJob).toContain("- automation-quality");
    expect(publishJob).toContain("- check");
    expect(publishJob).toContain("- container-smoke");
    expect(publishJob).toContain("- container-security-check");
    expect(publishJob).not.toMatch(/always\(\)|continue-on-error/);
    expect(publishJob).toContain("platforms: linux/amd64");
    expect(publishJob).toContain("target: prod");
    expect(publishJob).toContain("provenance: false");
    expect(publishJob).toContain("packages: write");
    expect(publishJob).toContain("tags: ${{ steps.candidate.outputs.image_ref }}:${{ steps.candidate.outputs.tag }}");
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

function readWorkflowJob(jobName) {
  const lines = workflow.split("\n");
  const jobStart = lines.findIndex((line) => line === `  ${jobName}:`);
  expect(jobStart).toBeGreaterThanOrEqual(0);
  const nextJob = lines.findIndex(
    (line, index) => index > jobStart && /^  [a-z0-9-]+:$/.test(line),
  );

  return lines.slice(jobStart, nextJob === -1 ? undefined : nextJob).join("\n");
}

it("selects reviewed v1alpha3 evidence for the exact published ECS digest", () => {
  const publish = readWorkflowJob("publish-ecs-image");
  const staticJob = readWorkflowJob("publish-static-artifact");
  expect(publish).toContain("github.repository == 'movie-reservation-platform-lab/movie-reservation-web'");
  expect(publish).toContain("component: reservation-web");
  expect(publish).toContain("digest: ${{ steps.publish.outputs.digest }}");
  expect(publish).toContain("attestations: write");
  expect(publish).toContain("id-token: write");
  expect(publish).toContain("evidence-version: v1alpha3");
  expect(publish).toContain("node-version: '24'");
  expect(publish).not.toMatch(/npm (?:ci|install)|continue-on-error/);
  expect(publish).toContain("name: publish temporary ECS image");
  expect(staticJob).not.toContain("/actions/container-evidence@");
  expect(staticJob).not.toMatch(/container-security-check|id-token:|attestations:/);
  expect(workflow).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
  expect(publish.indexOf("/actions/prepare-container-candidate@")).toBeLessThan(publish.indexOf("docker/login-action@"));
  expect(publish.indexOf("docker/build-push-action@")).toBeLessThan(publish.indexOf("/actions/container-evidence@"));
  const pins = [...publish.matchAll(/movie-reservation-platform-lab\/movie-platform-actions\/actions\/[^@]+@([a-f0-9]{40})/g)].map(m => m[1]);
  expect(pins).toEqual([sharedRevision, sharedRevision]);
});

describe("container vulnerability gate", () => {
  const security = readWorkflowJob("container-security-check");

  it("runs on PRs, main pushes and manual runs without skipping main's dependency", () => {
    const triggers = workflow.slice(workflow.indexOf("on:\n"), workflow.indexOf("\npermissions:"));
    expect(triggers).toBe("on:\n  pull_request:\n  push:\n    branches:\n      - main\n  workflow_dispatch:\n");
    expect(security).not.toMatch(/^    (?:if|needs):/m);
    expect(workflow).not.toMatch(/pull_request_target:|workflow_run:/);
    expect(security).toContain("timeout-minutes: 20");
  });

  it("has only read authority and cannot publish, attest or persist credentials", () => {
    expect(security.match(/^    permissions:\n((?:      .+\n)+)/m)?.[1]).toBe("      contents: read\n");
    expect(security).not.toMatch(/packages:|id-token:|attestations:|secrets\.|push: true|login-action|\/actions\/container-evidence@|prepare-container-candidate@/);
    const checkouts = security.split(/      - name: /).filter(step => step.includes("uses: actions/checkout@"));
    expect(checkouts).toHaveLength(2);
    for (const checkout of checkouts) expect(checkout).toContain("persist-credentials: false");
    expect(security).toContain("GH_TOKEN: ${{ github.token }}");
  });

  it("uses the reviewed shared scanner on this producer's amd64 production image", () => {
    expect(security).toContain("repository: movie-reservation-platform-lab/movie-platform-actions");
    expect(security).toContain(`ref: ${sharedRevision}`);
    expect(security).toContain("path: .platform-actions");
    expect(security).toContain("node-version: '24'");
    expect(security).toContain("docker build --pull --platform linux/amd64 --target prod --tag movie-reservation-web:pr-security .");
    const scan = readStep(security, "Evaluate complete report with current approved policy");
    expect(scan).toContain("node .platform-actions/local-tools/container-security/lib/scan.mjs");
    expect(scan).toContain("movie-reservation-web:pr-security");
    expect(scan).toContain("--evidence-version v1alpha3 --component reservation-web");
    expect(scan).not.toMatch(/--severity|--ignore|TRIVY_|policy-file|policy-revision|continue-on-error/);
    expect(readFileSync(".dockerignore", "utf8")).toMatch(/^\.platform-actions$/m);
  });

  it.each([0, 1, 2])("propagates shared scanner exit %i to the runner", exitCode => {
    const scan = readStep(security, "Evaluate complete report with current approved policy");
    const command = scan.split("        run: |\n")[1].split("\n").map(line => line.replace(/^          /, "")).join("\n");
    // Exercise the actual workflow shell with a command-boundary double. Exit 1
    // is policy rejection, 2 is scanner/report/policy acquisition failure.
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c",
      `node() { return ${exitCode}; }\n${command}`], { encoding: "utf8", env: { ...process.env, RUNNER_TEMP: "/tmp" } });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(exitCode);
    expect(security).not.toContain("continue-on-error:");
  });

  it("retains the entire diagnostics directory after scan or policy failure", () => {
    const upload = readStep(security, "Retain PR vulnerability diagnostics");
    // Explicit status function avoids GitHub's implicit success() condition.
    expect(upload).toContain("if: ${{ !cancelled() }}");
    expect(upload).toContain("uses: actions/upload-artifact@");
    expect(upload).toContain("name: reservation-web-pr-vulnerability-report-${{ github.run_id }}-attempt-${{ github.run_attempt }}");
    expect(upload).toContain("path: ${{ runner.temp }}/reservation-web-pr-security/\n");
    expect(upload).toContain("if-no-files-found: error");
    expect(upload).toContain("retention-days: 14");
    expect(security).toContain('--output-dir "$RUNNER_TEMP/reservation-web-pr-security"');
    expect(security.indexOf("lib/scan.mjs")).toBeLessThan(security.indexOf("Retain PR vulnerability diagnostics"));
    expect(security).not.toMatch(/\brm\s|\bfind\s.*delete/);
  });
});

function readStep(job, name) {
  const step = job.split(/(?=^      - name: )/m).find(part => part.startsWith(`      - name: ${name}\n`));
  expect(step, `Missing workflow step ${name}`).toBeDefined();
  return step;
}

it("tracks canonical AI guidance and ignores generated assistant and scan folders", () => {
  const ignored = [".claude", ".codex", ".cursor", ".gemini", ".roo", ".platform-actions", ".local-container-security", "security-evidence"];
  const result = spawnSync("git", ["check-ignore", "--no-index", ...ignored.map(folder => `${folder}/probe`)], { encoding: "utf8" });
  expect(result.status).toBe(0);
  expect(result.stdout.trim().split("\n")).toEqual(ignored.map(folder => `${folder}/probe`));
  expect(spawnSync("git", ["check-ignore", "--no-index", ".ai/project-guidance.md", "AGENTS.md"]).status).toBe(1);
});
