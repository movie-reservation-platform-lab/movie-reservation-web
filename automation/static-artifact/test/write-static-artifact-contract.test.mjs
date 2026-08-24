import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const configSource = new URL(
  "../../../scripts/static-artifact-config.json",
  import.meta.url,
);
const scriptSource = new URL(
  "../../../scripts/write-static-artifact-contract.mjs",
  import.meta.url,
);
const fixtureRoots = [];

const githubEnvironment = {
  GITHUB_REF_NAME: "main",
  GITHUB_REPOSITORY: "movie-reservation-platform-lab/movie-reservation-web",
  GITHUB_RUN_ID: "123456789",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_SHA: "0123456789abcdef0123456789abcdef01234567",
  SOURCE_DATE_EPOCH: "1786320000",
};

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((fixtureRoot) =>
      rm(fixtureRoot, {
        force: true,
        recursive: true,
      }),
    ),
  );
});

describe("write-static-artifact-contract CLI", () => {
  it("writes deterministic provenance, distribution, deployment, and file integrity metadata", async () => {
    const fixtureRoot = await createFixture();
    const files = {
      "assets/app.js": "console.log('movie reservation');\n",
      "assets/styles.css": "body { color: rebeccapurple; }\n",
      "index.html": "<!doctype html><title>Movie Reservation</title>\n",
    };

    await writeDistFiles(fixtureRoot, files);
    await writeFile(
      path.join(fixtureRoot, "dist", "static-artifact-contract.json"),
      "stale contract that must not hash itself\n",
    );

    await runGenerator(fixtureRoot);
    const contract = await readContract(fixtureRoot);

    expect(contract).toEqual({
      schemaVersion: 1,
      artifact: {
        name: "movie-reservation-web-fixture",
        version: "9.8.7",
        kind: "static-site-bundle",
        root: "dist",
        entrypoint: "index.html",
        files: Object.entries(files)
          .map(([filePath, contents]) => ({
            path: filePath,
            bytes: Buffer.byteLength(contents),
            sha256: sha256(contents),
          }))
          .sort((left, right) =>
            left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
          ),
      },
      provenance: {
        sourceRepository: githubEnvironment.GITHUB_REPOSITORY,
        sourceRevision: githubEnvironment.GITHUB_SHA,
        sourceRef: githubEnvironment.GITHUB_REF_NAME,
        builtAt: new Date(
          Number(githubEnvironment.SOURCE_DATE_EPOCH) * 1000,
        ).toISOString(),
        buildRef:
          "https://github.com/movie-reservation-platform-lab/movie-reservation-web/actions/runs/123456789",
      },
      distribution: {
        workflowArtifactName: `movie-reservation-web-fixture-static-${githubEnvironment.GITHUB_SHA}`,
        oci: {
          registry: "ghcr.io",
          repository: githubEnvironment.GITHUB_REPOSITORY,
          candidateTag: `sha-${githubEnvironment.GITHUB_SHA}`,
          artifactType: "application/vnd.movie-platform.static-site.v1",
          layerMediaType:
            "application/vnd.movie-platform.static-site.layer.v1.tar",
        },
      },
      deployment: {
        target: "private-s3-cloudfront",
        repositoryOwnsDeployment: false,
        spaFallback: "index.html",
        cachePolicy: [
          {
            pathPattern: "index.html",
            cacheControl: "no-cache",
          },
          {
            pathPattern: "assets/**",
            cacheControl: "public, max-age=31536000, immutable",
          },
          {
            pathPattern: "static-artifact-contract.json",
            cacheControl: "no-cache",
          },
        ],
        runtimeApi: {
          sameOriginGraphqlPath: "/graphql",
          buildTimeOverrideEnv: "VITE_GRAPHQL_URL",
        },
        diagnostics: {
          propagatedHeaders: [
            "traceparent",
            "X-Correlation-Id",
            "X-Request-Id",
          ],
        },
      },
    });

    await runGenerator(fixtureRoot);

    expect(await readContract(fixtureRoot)).toEqual(contract);
  });

  it("fails with an actionable error when the Vite entrypoint is missing", async () => {
    const fixtureRoot = await createFixture();

    await expect(runGenerator(fixtureRoot)).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "dist/index.html was not found. Run `npm run build` before writing the artifact contract.",
      ),
    });
  });

  it("rejects malformed SOURCE_DATE_EPOCH values", async () => {
    const fixtureRoot = await createFixture();

    await writeDistFiles(fixtureRoot, {
      "index.html": "<!doctype html>\n",
    });

    await expect(
      runGenerator(fixtureRoot, {
        SOURCE_DATE_EPOCH: "not-a-timestamp",
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "SOURCE_DATE_EPOCH must be a non-negative integer number of seconds.",
      ),
    });
  });

  it("fails instead of publishing degraded provenance outside a Git checkout", async () => {
    const fixtureRoot = await createFixture();

    await writeDistFiles(fixtureRoot, {
      "index.html": "<!doctype html>\n",
    });

    await expect(
      runGenerator(fixtureRoot, {
        GITHUB_SHA: undefined,
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Unable to determine source revision. Set GITHUB_SHA or run the command in a Git checkout.",
      ),
    });
  });

  it("rejects filesystem entries that cannot be represented by the checksum inventory", async () => {
    const fixtureRoot = await createFixture();

    await writeDistFiles(fixtureRoot, {
      "index.html": "<!doctype html>\n",
    });
    await symlink(
      "index.html",
      path.join(fixtureRoot, "dist", "linked-index.html"),
    );

    await expect(runGenerator(fixtureRoot)).rejects.toMatchObject({
      stderr: expect.stringContaining(
        "Unsupported static artifact entry: linked-index.html. Only regular files and directories are allowed.",
      ),
    });
  });
});

async function createFixture() {
  const fixtureRoot = await mkdtemp(
    path.join(tmpdir(), "movie-reservation-web-static-contract-"),
  );
  fixtureRoots.push(fixtureRoot);

  await mkdir(path.join(fixtureRoot, "scripts"));
  await mkdir(path.join(fixtureRoot, "dist"));
  await copyFile(
    scriptSource,
    path.join(fixtureRoot, "scripts", "write-static-artifact-contract.mjs"),
  );
  await copyFile(
    configSource,
    path.join(fixtureRoot, "scripts", "static-artifact-config.json"),
  );
  await writeFile(
    path.join(fixtureRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "movie-reservation-web-fixture",
        version: "9.8.7",
        type: "module",
      },
      null,
      2,
    )}\n`,
  );

  return fixtureRoot;
}

async function writeDistFiles(fixtureRoot, files) {
  await Promise.all(
    Object.entries(files).map(async ([filePath, contents]) => {
      const absolutePath = path.join(fixtureRoot, "dist", filePath);

      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents);
    }),
  );
}

async function runGenerator(fixtureRoot, environment = {}) {
  const childEnvironment = {
    ...process.env,
    ...githubEnvironment,
    ...environment,
  };

  for (const [environmentName, environmentValue] of Object.entries(
    childEnvironment,
  )) {
    if (environmentValue === undefined) {
      delete childEnvironment[environmentName];
    }
  }

  return execFileAsync(
    process.execPath,
    [path.join(fixtureRoot, "scripts", "write-static-artifact-contract.mjs")],
    {
      cwd: fixtureRoot,
      env: childEnvironment,
    },
  );
}

async function readContract(fixtureRoot) {
  return JSON.parse(
    await readFile(
      path.join(fixtureRoot, "dist", "static-artifact-contract.json"),
      "utf8",
    ),
  );
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}
