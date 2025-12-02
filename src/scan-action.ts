import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as fs from "fs/promises";
import * as path from "path";
import { DependencyScanInput } from "./input";
import { sleep } from "./utils";
import { Sbom } from "./sbom";
import { ApiErrorResponse, SbomApiClient, SbomScanResult } from "./api";
import { SummaryWriter } from "./summary-writer";

export type DependencyScanRunResult =
  | {
      status: "Success";
      result: Omit<SbomScanResult, "status">;
      scanId: string;
    }
  | { status: "Skipped"; message: string; scanId: string }
  | {
      status: "Failure";
      result: Omit<SbomScanResult, "status">;
      scanId: string;
    }
  | {
      status: "Error";
      message: string;
      scanId?: string;
    };

export type DependencyScanRunStatus = DependencyScanRunResult["status"];
const DependencyScanStatusMetadata: Record<
  DependencyScanRunStatus,
  { emoji: string; verb: string }
> = {
  Success: { emoji: "✅", verb: "succeeded" },
  Failure: { emoji: "❌", verb: "failed due to policy violations" },
  Error: { emoji: "❌", verb: "encountered an error" },
  Skipped: { emoji: "⏭️", verb: "skipped" },
};

export type WaitForScanCompletionResult =
  | {
      status: "Success";
      result: SbomScanResult;
    }
  | {
      status: "Failure";
      result: ApiErrorResponse;
    }
  | {
      status: "Timeout";
    };

export class DependencyScanAction {
  private readonly api: SbomApiClient;

  constructor(private readonly input: DependencyScanInput) {
    this.api = new SbomApiClient(input.apiBaseUrl, input.apiToken, {
      timeoutSeconds: 30,
      maxRetries: 2,
      debug: input.debug,
    });
  }

  private async generateSbom(): Promise<Sbom | undefined> {
    await exec.exec("cdxgen", ["."], { cwd: this.input.repoScanPath });
    const bomPath = path.join(this.input.repoScanPath, "bom.json");

    if (!(await fs.stat(bomPath)).isFile()) {
      return;
    }

    return JSON.parse(await fs.readFile(bomPath, "utf-8")) as Sbom;
  }

  private async waitForScanCompletion(
    scanId: string
  ): Promise<WaitForScanCompletionResult> {
    const startTime = Date.now();

    while (true) {
      const response = await this.api.getScanResult(scanId);

      if (!response.success) {
        return {
          status: "Failure",
          result: response.data,
        };
      }

      if (response.data.status !== "Pending") {
        return {
          status: "Success",
          result: response.data,
        };
      }

      const elapsedTimeSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remainingSeconds = Math.max(
        0,
        this.input.scanTimeoutSeconds - elapsedTimeSeconds
      );

      core.info(
        `Waiting for scan completion (remaining: ${remainingSeconds}s)...`
      );

      if (remainingSeconds <= 0) {
        core.info(
          `startTime=${startTime}, elapsedTimeSeconds=${elapsedTimeSeconds}`
        );
        return { status: "Timeout" };
      }

      await sleep(10_000);
    }
  }

  private async tryRun(): Promise<DependencyScanRunResult> {
    try {
      /****** Generate SBOM ******/
      core.info("Generating SBOM with cdxgen...");
      const sbom = await this.generateSbom();

      if (!sbom) {
        return {
          status: "Error",
          message: "cdxgen did not generate bom.json",
        };
      }

      core.info(JSON.stringify(sbom.metadata?.tools?.components?.[0], null, 2));
      core.info("SBOM generated successfully");

      /****** Start SBOM Scan ******/

      const apiPath = path
        .normalize(path.join("/", this.input.scanPath))
        // on Windows, the path separator is \, but the API expects /
        .replaceAll("\\", "/");

      core.info(
        `Starting SBOM scan with repositoryUrl=${this.input.repoUrl}, branch=${this.input.branch}, path=${apiPath}`
      );
      const startScanResponse = await this.api.startScan({
        repositoryUrl: this.input.repoUrl,
        branch: this.input.branch,
        path: apiPath,
      });

      if (!startScanResponse.success) {
        return {
          status: "Error",
          message: `Failed to start scan with HTTP status code: ${
            startScanResponse.data.status
          }, message: ${
            startScanResponse.data.message
          }, full response: ${JSON.stringify(startScanResponse, null, 2)}`,
        };
      }

      const scanId = startScanResponse.data.scanId;
      const uploadUrl = startScanResponse.data.uploadUrl;

      core.info(`scanId=${scanId}`);
      core.info("Uploading SBOM...");

      const response = await this.api.uploadSbom(uploadUrl, sbom);

      if (!response.success) {
        return {
          status: "Error",
          message: `Failed to upload SBOM with HTTP status code: ${response.data.status}`,
          scanId: scanId,
        };
      }

      /****** Wait for Scan Completion ******/

      const waitForScanResult = await this.waitForScanCompletion(scanId);

      if (waitForScanResult.status === "Timeout") {
        return {
          status: "Error",
          message: "Scan did not complete within the timeout.",
          scanId: scanId,
        };
      } else if (waitForScanResult.status === "Failure") {
        return {
          status: "Error",
          message: `Failed to get scan result with HTTP status code: ${waitForScanResult.result.message}`,
          scanId: scanId,
        };
      }

      const scanResult = waitForScanResult.result;

      switch (scanResult.status) {
        case "Success":
          return {
            status: "Success",
            result: scanResult,
            scanId: scanId,
          };
        case "Failure":
          return {
            status: "Failure",
            result: scanResult,
            scanId: scanId,
          };
        case "Error":
          return {
            status: "Error",
            message: `Errors encountered during SBOM scan, ${scanResult.errors.join(
              ", "
            )}`,
            scanId: scanId,
          };
        case "Skipped":
          return {
            status: "Skipped",
            message: `Scan skipped, reason: ${scanResult.reason}`,
            scanId: scanId,
          };
        default:
          return {
            status: "Error",
            message: `Scan returned an unexpected status: ${scanResult.status}`,
            scanId: scanId,
          };
      }
    } catch (err) {
      return {
        status: "Error",
        message:
          err instanceof Error ? err.message : "An unknown error occurred",
      };
    }
  }

  private async setOutputs(result: DependencyScanRunResult): Promise<void> {
    core.setOutput("status", result.status);
    core.setOutput("scan_id", result.scanId ?? "");
  }

  private async writeSummary(result: DependencyScanRunResult): Promise<void> {
    const statusMetadata = DependencyScanStatusMetadata[result.status];
    let summaryMessage: string;
    let findingsSummary: SbomScanResult["findingsSummary"] | undefined;

    const sentence = `${statusMetadata.emoji} Scan ${
      statusMetadata.verb
    } for branch \`${this.input.branch}\` at path \`${
      this.input.scanPath
    }\` (Scan ID: \`${result.scanId || "None"}\`).`;

    core.info(sentence);

    switch (result.status) {
      case "Success":
        summaryMessage = "✅ Scan completed successfully with no findings.";
        findingsSummary = result.result.findingsSummary;
        break;
      case "Failure":
        summaryMessage = `❌ One or more policy violations found.`;
        findingsSummary = result.result.findingsSummary;
        break;
      case "Error":
        summaryMessage = `❌ Scan encountered an error: ${result.message}`;
        break;
      case "Skipped":
        summaryMessage = `⏭️ Scan skipped, reason: ${result.message}`;
        break;
    }

    core.info(summaryMessage);

    await SummaryWriter.writeSummary(summaryMessage, findingsSummary);
  }

  public async run(): Promise<void> {
    const result = await this.tryRun();

    await this.setOutputs(result);
    await this.writeSummary(result);

    // exit 1 on failure
    if (
      result.status === "Error" ||
      (result.status === "Failure" && this.input.onFindings === "fail")
    ) {
      process.exit(1);
    }
  }
}
