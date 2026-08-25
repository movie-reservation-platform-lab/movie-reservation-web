import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const packageManifest = JSON.parse(readFileSync("package.json", "utf8"));
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

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
    expect(frontendConfig).toContain('include: ["src/**/*.test.ts"]');
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
    expect(smokeJob).not.toContain("packages: write");
    expect(publishJob).toContain("github.event_name == 'push'");
    expect(publishJob).toContain("github.ref == 'refs/heads/main'");
    expect(publishJob).toContain("- automation-quality");
    expect(publishJob).toContain("- check");
    expect(publishJob).toContain("- container-smoke");
    expect(publishJob).toContain("platforms: linux/amd64");
    expect(publishJob).toContain("provenance: false");
    expect(publishJob).toContain("packages: write");
    expect(publishJob).toContain("ecs-demo-sha-${{ github.sha }}");
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
