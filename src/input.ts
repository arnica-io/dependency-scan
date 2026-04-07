import * as path from "path";
import { Platform } from "./platform/platform";
import {
  isBitbucketEnvironment,
  isGitHubEnvironment,
  isGitLabEnvironment,
} from "./platform/select-platform";

const onFindings: readonly string[] = ["fail", "alert", "pass"];

function normalizeBitbucketCloudUrl(rawUrl: string): string {
  if (!rawUrl) {
    return rawUrl;
  }

  if (rawUrl.startsWith("git@bitbucket.org:")) {
    return `https://bitbucket.org/${rawUrl.slice("git@bitbucket.org:".length)}`;
  }

  if (rawUrl.startsWith("ssh://git@bitbucket.org/")) {
    return `https://bitbucket.org/${rawUrl.slice("ssh://git@bitbucket.org/".length)}`;
  }

  if (rawUrl.startsWith("http://bitbucket.org/")) {
    return `https://bitbucket.org/${rawUrl.slice("http://bitbucket.org/".length)}`;
  }

  return rawUrl;
}

function isAzureEnvironment(): boolean {
  return Boolean(
    process.env.TF_BUILD ||
      process.env.BUILD_BUILDID ||
      process.env.BUILD_REPOSITORY_URI ||
      process.env.BUILD_SOURCEBRANCHNAME
  );
}

function getGitHubRepositoryUrlFallback(): string {
  if (!process.env.GITHUB_REPOSITORY) {
    return "";
  }

  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const trimmedServerUrl = serverUrl.replace(/\/+$/u, "");
  return `${trimmedServerUrl}/${process.env.GITHUB_REPOSITORY}`;
}

function getGitHubBranchFallback(): string {
  if (process.env.GITHUB_HEAD_REF) {
    return process.env.GITHUB_HEAD_REF;
  }

  if (process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }

  const ref = process.env.GITHUB_REF || "";
  if (ref.startsWith("refs/heads/")) {
    return ref.slice("refs/heads/".length);
  }

  return "";
}

function getBitbucketRepositoryUrlFallback(): string {
  const directUrl =
    process.env.BITBUCKET_GIT_HTTP_ORIGIN || process.env.BITBUCKET_GIT_SSH_ORIGIN;
  if (directUrl) {
    return directUrl;
  }

  const repoFullName =
    process.env.BITBUCKET_REPO_FULL_NAME ||
    (process.env.BITBUCKET_WORKSPACE && process.env.BITBUCKET_REPO_SLUG
      ? `${process.env.BITBUCKET_WORKSPACE}/${process.env.BITBUCKET_REPO_SLUG}`
      : "") ||
    (process.env.BITBUCKET_REPO_OWNER && process.env.BITBUCKET_REPO_SLUG
      ? `${process.env.BITBUCKET_REPO_OWNER}/${process.env.BITBUCKET_REPO_SLUG}`
      : "");
  if (!repoFullName) {
    return "";
  }

  const bitbucketServerBaseUrl =
    process.env.BITBUCKET_SERVER_URL || process.env.BITBUCKET_BASE_URL;
  if (bitbucketServerBaseUrl) {
    const trimmedBase = bitbucketServerBaseUrl.replace(/\/+$/u, "");
    const scmPrefix = (
      process.env.BITBUCKET_SERVER_SCM_PREFIX || "scm"
    ).replace(/^\/+|\/+$/gu, "");
    return `${trimmedBase}/${scmPrefix}/${repoFullName}.git`;
  }

  return `https://bitbucket.org/${repoFullName}`;
}

function getBitbucketBranchFallback(): string {
  return (
    process.env.BITBUCKET_BRANCH ||
    process.env.BITBUCKET_PR_SOURCE_BRANCH ||
    process.env.BITBUCKET_SOURCE_BRANCH ||
    process.env.BITBUCKET_BRANCH_NAME ||
    ""
  );
}

function getGitLabRepositoryUrlFallback(): string {
  // Agentic Rule (ARNIE_SECRET_SECRET_MASKING): CI_REPOSITORY_URL may embed CI job tokens — caller MUST pass through normalizeRepositoryUrl()
  const ciRepoUrl = process.env.CI_REPOSITORY_URL;
  if (ciRepoUrl) {
    return ciRepoUrl;
  }
  return process.env.CI_PROJECT_URL || "";
}

function getGitLabBranchFallback(): string {
  if (process.env.CI_COMMIT_BRANCH) {
    return process.env.CI_COMMIT_BRANCH;
  }
  if (process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME) {
    return process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME;
  }
  if (!process.env.CI_COMMIT_TAG && process.env.CI_COMMIT_REF_NAME) {
    return process.env.CI_COMMIT_REF_NAME;
  }
  return "";
}

function normalizeRepositoryUrl(rawUrl: string): string {
  if (!rawUrl) {
    return rawUrl;
  }

  const bitbucketNormalized = normalizeBitbucketCloudUrl(rawUrl);

  try {
    const parsed = new URL(bitbucketNormalized);
    // Agentic Rule (ARNIE_SECRET_SECRET_MASKING): Strip embedded credentials from repository URLs before sending/logging
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    // Fallback for non-URL inputs (or unusual URL formats): remove userinfo from https://user@host/...
    return bitbucketNormalized.replace(/^https:\/\/[^/@]+@/u, "https://");
  }
}

export interface DependencyScanInput {
  readonly repoUrl: string;
  readonly branch: string;
  /**
   * Absolute scan path, e.g. `/`.
   */
  readonly scanPath: string;
  /**
   * Path to the repository on the CI runner to scan.
   */
  readonly repoScanPath: string;
  readonly apiBaseUrl: string;
  readonly scanTimeoutSeconds: number;
  readonly apiToken: string;
  readonly onFindings: string;
  readonly debug: boolean;
}

export function getValidatedInput(platform: Platform): DependencyScanInput {
  const workspacePath = platform.getWorkspacePath();

  const scanPath =
    process.env.INPUT_SCAN_PATH ||
    process.env.SCAN_PATH ||
    process.env.ARNICA_SCAN_PATH ||
    ".";

  const scanTimeoutSeconds = parseInt(
    process.env.INPUT_SCAN_TIMEOUT_SECONDS ||
      process.env.SCAN_TIMEOUT_SECONDS ||
      process.env.ARNICA_SCAN_TIMEOUT_SECONDS ||
      "900",
    10
  );

  const input: DependencyScanInput = {
    repoUrl: normalizeRepositoryUrl(
      process.env.INPUT_REPOSITORY_URL ||
        process.env.REPOSITORY_URL ||
        process.env.ARNICA_REPOSITORY_URL ||
        getGitHubRepositoryUrlFallback() ||
        process.env.BUILD_REPOSITORY_URI ||
        getBitbucketRepositoryUrlFallback() ||
        getGitLabRepositoryUrlFallback() ||
        ""
    ),
    branch:
      process.env.INPUT_BRANCH ||
      process.env.BRANCH ||
      process.env.ARNICA_BRANCH ||
      getGitHubBranchFallback() ||
      process.env.BUILD_SOURCEBRANCHNAME ||
      getBitbucketBranchFallback() ||
      getGitLabBranchFallback() ||
      "main",
    scanPath,
    repoScanPath: path.normalize(
      path.join(workspacePath, scanPath)
    ),
    apiBaseUrl:
      process.env.INPUT_API_BASE_URL ||
      process.env.API_BASE_URL ||
      process.env.ARNICA_API_BASE_URL ||
      "https://api.app.arnica.io",
    scanTimeoutSeconds,
    apiToken:
      process.env.INPUT_API_TOKEN ||
      process.env.API_TOKEN ||
      process.env.ARNICA_API_TOKEN ||
      "",
    onFindings:
      process.env.INPUT_ON_FINDINGS ||
      process.env.ON_FINDINGS ||
      process.env.ARNICA_ON_FINDINGS ||
      "fail",
    debug:
      process.env.INPUT_DEBUG === "true" ||
      process.env.ARNICA_DEBUG_MODE === "true" ||
      process.env.ARNICA_DEBUG === "true",
  };

  if (input.debug) {
    // Agentic Rule (ARNIE_SECRET_SECRET_MASKING): Never log API token value; mask in structured debug output
    const { apiToken: _token, ...inputForLog } = input;
    platform.info(`Workspace path: ${workspacePath}`);
    platform.info(
      `Input: ${JSON.stringify(
        { ...inputForLog, apiToken: _token ? "(redacted)" : "(empty)" },
        null,
        2
      )}`
    );
  }

  if (!onFindings.includes(input.onFindings)) {
    const msg = `Invalid on-findings value: '${input.onFindings}'. Must be one of: ${onFindings.join(", ")}`;
    platform.setFailed(msg);
    throw new Error(msg);
  }

  if (!Number.isFinite(scanTimeoutSeconds) || scanTimeoutSeconds < 1) {
    const msg = `Invalid scan-timeout-seconds: must be a positive integer`;
    platform.setFailed(msg);
    throw new Error(msg);
  }

  if (!input.apiToken) {
    const msg =
      "API token is missing. Pass env ARNICA_API_TOKEN from a secret.";
    platform.setFailed(msg);
    throw new Error(msg);
  }

  if (input.apiToken.startsWith("$")) {
    const msg =
      "API token appears to be an unresolved variable placeholder. Set ARNICA_API_TOKEN to the real token value, not '$ARNICA_API_TOKEN'.";
    platform.setFailed(msg);
    throw new Error(msg);
  }

  const isKnownCiEnvironment =
    isGitHubEnvironment(process.env) ||
    isBitbucketEnvironment(process.env) ||
    isGitLabEnvironment(process.env) ||
    isAzureEnvironment();

  if (isKnownCiEnvironment && !input.repoUrl) {
    const msg =
      "Repository URL is missing in CI environment. Set REPOSITORY_URL explicitly.";
    platform.setFailed(msg);
    throw new Error(msg);
  }

  return input;
}
