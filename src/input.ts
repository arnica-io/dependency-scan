import * as core from "@actions/core";
import * as path from "path";

const onFindings: readonly string[] = ["fail", "alert", "pass"];

export interface DependencyScanInput {
  readonly repoUrl: string;
  readonly branch: string;
  /**
   * Absolute scan path, e.g. `/`.
   */
  readonly scanPath: string;
  /**
   * Path to the repository in the GitHub runner to scan.
   */
  readonly repoScanPath: string;
  readonly apiBaseUrl: string;
  readonly scanTimeoutSeconds: number;
  readonly apiToken: string;
  readonly onFindings: string;
  readonly debug: boolean;
}

export function getValidatedInput(): DependencyScanInput {
  const input: DependencyScanInput = {
    repoUrl: process.env.INPUT_REPOSITORY_URL || "",
    branch: process.env.INPUT_BRANCH || "",
    scanPath: process.env.INPUT_SCAN_PATH || "",
    // The scan path is relative to the repository root
    repoScanPath: path.normalize(
      path.join(
        process.env.GITHUB_WORKSPACE || "",
        process.env.INPUT_SCAN_PATH || ""
      )
    ),
    apiBaseUrl: process.env.INPUT_API_BASE_URL || "",
    scanTimeoutSeconds: parseInt(
      process.env.INPUT_SCAN_TIMEOUT_SECONDS || "900",
      10
    ),
    apiToken: process.env.INPUT_API_TOKEN || process.env.ARNICA_API_TOKEN || "",
    onFindings: process.env.INPUT_ON_FINDINGS || "fail",
    debug: process.env.INPUT_DEBUG === "true",
  };

  if (input.debug) {
    core.info(`env.GITHUB_WORKSPACE=${process.env.GITHUB_WORKSPACE}`);
    core.info(`Input: ${JSON.stringify(input, null, 2)}`);
  }

  // Validate ON_FINDINGS input
  if (!onFindings.includes(input.onFindings)) {
    core.setFailed(
      `Invalid on-findings value: '${
        input.onFindings
      }'. Must be one of: ${onFindings.join(", ")}`
    );
  }

  if (!input.apiToken) {
    core.setFailed(
      "API token is missing. Pass env ARNICA_API_TOKEN from a secret."
    );
  }

  return input;
}
