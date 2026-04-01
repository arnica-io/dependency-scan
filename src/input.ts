import * as path from "path";
import { Platform } from "./platform/platform";

const onFindings: readonly string[] = ["fail", "alert", "pass"];

function isBitbucketEnvironment(): boolean {
  return Boolean(
    process.env.BITBUCKET_PIPELINE_UUID ||
      process.env.BITBUCKET_CLONE_DIR ||
      process.env.BITBUCKET_REPO_FULL_NAME ||
      process.env.BITBUCKET_GIT_HTTP_ORIGIN ||
      process.env.BITBUCKET_GIT_SSH_ORIGIN ||
      process.env.BITBUCKET_BRANCH ||
      process.env.BITBUCKET_PR_SOURCE_BRANCH ||
      process.env.BITBUCKET_SOURCE_BRANCH ||
      process.env.BITBUCKET_BRANCH_NAME
  );
}

function getBitbucketRepositoryUrlFallback(): string {
  const directUrl =
    process.env.BITBUCKET_GIT_HTTP_ORIGIN || process.env.BITBUCKET_GIT_SSH_ORIGIN;
  if (directUrl) {
    return directUrl;
  }

  const repoFullName = process.env.BITBUCKET_REPO_FULL_NAME;
  if (!repoFullName) {
    return "";
  }

  const bitbucketServerBaseUrl =
    process.env.BITBUCKET_SERVER_URL || process.env.BITBUCKET_BASE_URL;
  if (bitbucketServerBaseUrl) {
    const trimmedBase = bitbucketServerBaseUrl.replace(/\/+$/u, "");
    return `${trimmedBase}/scm/${repoFullName}.git`;
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

function normalizeRepositoryUrl(rawUrl: string): string {
  if (!rawUrl) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    // Agentic Rule (ARNIE_SECRET_SECRET_MASKING): Strip embedded credentials from repository URLs before sending/logging
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    // Fallback for non-URL inputs (or unusual URL formats): remove userinfo from https://user@host/...
    return rawUrl.replace(/^https:\/\/[^/@]+@/u, "https://");
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

  const scanPath = process.env.INPUT_SCAN_PATH || ".";

  const scanTimeoutSeconds = parseInt(
    process.env.INPUT_SCAN_TIMEOUT_SECONDS || "900",
    10
  );

  const input: DependencyScanInput = {
    repoUrl: normalizeRepositoryUrl(
      process.env.INPUT_REPOSITORY_URL ||
        process.env.BUILD_REPOSITORY_URI ||
        getBitbucketRepositoryUrlFallback() ||
        ""
    ),
    branch:
      process.env.INPUT_BRANCH ||
      process.env.BUILD_SOURCEBRANCHNAME ||
      getBitbucketBranchFallback() ||
      "main",
    scanPath,
    repoScanPath: path.normalize(
      path.join(workspacePath, scanPath)
    ),
    apiBaseUrl:
      process.env.INPUT_API_BASE_URL ||
      process.env.ARNICA_API_BASE_URL ||
      "https://api.app.arnica.io",
    scanTimeoutSeconds,
    apiToken: process.env.INPUT_API_TOKEN || process.env.ARNICA_API_TOKEN || "",
    onFindings: process.env.INPUT_ON_FINDINGS || "fail",
    debug: process.env.INPUT_DEBUG === "true",
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

  if (isBitbucketEnvironment() && !input.repoUrl) {
    const msg =
      "Repository URL is missing in Bitbucket environment. Set INPUT_REPOSITORY_URL explicitly.";
    platform.setFailed(msg);
    throw new Error(msg);
  }

  return input;
}
