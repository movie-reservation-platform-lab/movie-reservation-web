import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const defaultSourceRepository =
  "movie-reservation-platform-lab/movie-reservation-web";
const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const distRoot = path.join(repoRoot, "dist");
const contractPath = path.join(distRoot, "static-artifact-contract.json");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function buildValue(environmentName, gitArgs, description) {
  const environmentValue = process.env[environmentName]?.trim();

  if (environmentValue !== undefined && environmentValue !== "") {
    return environmentValue;
  }

  try {
    const { stdout } = await execFileAsync("git", gitArgs, { cwd: repoRoot });
    const gitOutput = stdout.trim();

    if (gitOutput !== "") {
      return gitOutput;
    }
  } catch (error) {
    throw new Error(
      `Unable to determine ${description}. Set ${environmentName} or run the command in a Git checkout.`,
      { cause: error },
    );
  }

  throw new Error(
    `Unable to determine ${description}. Set ${environmentName} or run the command on a named Git branch.`,
  );
}

async function listBuiltFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);

      if (absolutePath === contractPath) {
        return [];
      }

      if (entry.isDirectory()) {
        return listBuiltFiles(absolutePath);
      }

      if (!entry.isFile()) {
        const relativePath = path
          .relative(distRoot, absolutePath)
          .split(path.sep)
          .join("/");

        throw new Error(
          `Unsupported static artifact entry: ${relativePath}. Only regular files and directories are allowed.`,
        );
      }

      const contents = await readFile(absolutePath);
      const relativePath = path.relative(distRoot, absolutePath).split(path.sep).join("/");

      return [
        {
          path: relativePath,
          bytes: contents.byteLength,
          sha256: createHash("sha256").update(contents).digest("hex"),
        },
      ];
    }),
  );

  return files.flat().sort((left, right) => {
    if (left.path < right.path) {
      return -1;
    }

    if (left.path > right.path) {
      return 1;
    }

    return 0;
  });
}

function buildTime() {
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;

  if (sourceDateEpoch !== undefined && sourceDateEpoch !== "") {
    if (!/^\d+$/.test(sourceDateEpoch)) {
      throw new Error("SOURCE_DATE_EPOCH must be a non-negative integer number of seconds.");
    }

    const milliseconds = Number(sourceDateEpoch) * 1000;
    const date = new Date(milliseconds);

    if (!Number.isSafeInteger(milliseconds) || Number.isNaN(date.getTime())) {
      throw new Error("SOURCE_DATE_EPOCH is outside the supported date range.");
    }

    return date.toISOString();
  }

  return new Date().toISOString();
}

function githubBuildRef(sourceRepository) {
  const serverUrl = process.env.GITHUB_SERVER_URL;
  const runId = process.env.GITHUB_RUN_ID;

  if (serverUrl === undefined || runId === undefined) {
    return undefined;
  }

  return `${serverUrl.replace(/\/$/, "")}/${sourceRepository}/actions/runs/${runId}`;
}

if (!existsSync(path.join(distRoot, "index.html"))) {
  throw new Error("dist/index.html was not found. Run `npm run build` before writing the artifact contract.");
}

const packageJson = await readJson(path.join(repoRoot, "package.json"));
const staticArtifactConfig = await readJson(
  path.join(repoRoot, "scripts", "static-artifact-config.json"),
);
const gitSha = await buildValue(
  "GITHUB_SHA",
  ["rev-parse", "HEAD"],
  "source revision",
);
const gitRef = await buildValue(
  "GITHUB_REF_NAME",
  ["branch", "--show-current"],
  "source ref",
);
const sourceRepository = process.env.GITHUB_REPOSITORY ?? defaultSourceRepository;
const buildRef = githubBuildRef(sourceRepository);
const files = await listBuiltFiles(distRoot);

if (!/^[a-f0-9]{40}$/.test(gitSha)) {
  throw new Error("Source revision must be a full 40-character lowercase Git SHA.");
}

for (const configKey of [
  "artifactKind",
  "registry",
  "artifactType",
  "layerMediaType",
]) {
  if (
    typeof staticArtifactConfig[configKey] !== "string" ||
    staticArtifactConfig[configKey].trim() === ""
  ) {
    throw new Error(`Static artifact config field ${configKey} must be a non-empty string.`);
  }
}

const contract = {
  schemaVersion: 1,
  artifact: {
    name: packageJson.name,
    version: packageJson.version,
    kind: staticArtifactConfig.artifactKind,
    root: "dist",
    entrypoint: "index.html",
    files,
  },
  provenance: {
    sourceRepository,
    sourceRevision: gitSha,
    sourceRef: gitRef,
    builtAt: buildTime(),
    ...(buildRef === undefined ? {} : { buildRef }),
  },
  distribution: {
    workflowArtifactName: `${packageJson.name}-static-${gitSha}`,
    oci: {
      registry: staticArtifactConfig.registry,
      repository: sourceRepository,
      candidateTag: `sha-${gitSha}`,
      artifactType: staticArtifactConfig.artifactType,
      layerMediaType: staticArtifactConfig.layerMediaType,
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
      propagatedHeaders: ["traceparent", "X-Correlation-Id", "X-Request-Id"],
    },
  },
};

await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, contractPath)}`);
