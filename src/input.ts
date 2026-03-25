import * as path from "path";
import { Platform } from "./platform/platform";

const onFindings: readonly string[] = ["fail", "alert", "pass"];

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

  const input: DependencyScanInput = {
    repoUrl: process.env.INPUT_REPOSITORY_URL || "",
    branch: process.env.INPUT_BRANCH || "",
    scanPath: process.env.INPUT_SCAN_PATH || "",
    repoScanPath: path.normalize(
      path.join(workspacePath, process.env.INPUT_SCAN_PATH || "")
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
    platform.info(`Workspace path: ${workspacePath}`);
    platform.info(`Input: ${JSON.stringify(input, null, 2)}`);
  }

  if (!onFindings.includes(input.onFindings)) {
    platform.setFailed(
      `Invalid on-findings value: '${
        input.onFindings
      }'. Must be one of: ${onFindings.join(", ")}`
    );
  }

  if (!input.apiToken) {
    platform.setFailed(
      "API token is missing. Pass env ARNICA_API_TOKEN from a secret."
    );
  }

  return input;
}
