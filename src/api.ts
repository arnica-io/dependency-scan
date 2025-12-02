import { Sbom } from "./sbom";
import * as core from "@actions/core";

export interface StartSbomScanRequest {
  readonly repositoryUrl: string;
  readonly branch: string;
  readonly path: string;
}

export interface ApiErrorResponse {
  readonly status: number;
  readonly message: string;
}

export interface StartSbomScanResponse {
  readonly scanId: string;
  readonly uploadUrl: string;
}

export enum ScanStatus {
  Pending = "Pending",
  Success = "Success",
  Failure = "Failure",
  Error = "Error",
  Skipped = "Skipped",
}

export interface SbomScanResult {
  readonly status: ScanStatus;
  readonly reason?: string;
  readonly errors: string[];
  readonly findingsSummary: {
    readonly findings: Finding[];
    readonly total: number;
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
    readonly info: number;
  };
}

export const FindingSeverity = ["critical", "high", "medium", "low"] as const;
export type FindingSeverity = (typeof FindingSeverity)[number];

export interface Finding {
  readonly severity: FindingSeverity;
  readonly title: string;
  readonly type:
    | "SECRET"
    | "SAST"
    | "SCA"
    | "IAC"
    | "LICENSE"
    | "REPUTATION"
    | "AGGREGATE";
  readonly status: string;
  readonly recommendation?: {
    readonly description: string;
  };
}

export type ApiResponse<T, U = ApiErrorResponse> =
  | { success: true; data: T }
  | { success: false; data: U };
export type UploadSbomResponse = ApiResponse<void>;

export interface ApiOptions {
  readonly timeoutSeconds: number;
  readonly maxRetries: number;
  readonly debug: boolean;
}

export class SbomApiClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly apiToken: string,
    private readonly options: ApiOptions
  ) {}

  private static async getResponseBody<T>(
    response: Response
  ): Promise<T | undefined> {
    const text = await response.text();

    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return undefined;
    }
  }

  private async fetchWithRetries<T>(
    url: string,
    options: Omit<RequestInit, "signal">
  ): Promise<ApiResponse<T, ApiErrorResponse>> {
    let result: ApiResponse<T, ApiErrorResponse>;
    let response: Response | undefined;
    let error: string | undefined;

    if (this.options.debug) {
      core.info(
        `Fetching ${options.method || "GET"} ${url} with body: ${JSON.stringify(
          options.body || "",
          null,
          2
        )}...`
      );
    }

    for (let attempt = 1; attempt <= this.options.maxRetries + 1; attempt++) {
      try {
        response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.options.timeoutSeconds * 1000),
        });

        if (response.ok) {
          break;
        }
      } catch (e) {
        error = `Failed to ${options.method || "GET"} ${url} with error: ${
          e instanceof Error ? e.message : String(e)
        }`;

        core.error(error);
      }
    }

    if (response) {
      if (response.ok) {
        result = {
          success: true,
          data: (await SbomApiClient.getResponseBody(response)) as T,
        };
      } else {
        result = {
          success: false,
          data: {
            status: response.status,
            message:
              (await SbomApiClient.getResponseBody<ApiErrorResponse>(response))
                ?.message ||
              response.statusText ||
              error ||
              "Unknown error",
          },
        };
      }
    } else {
      result = {
        success: false,
        data: {
          status: 400,
          message: error || "Failed after all retries",
        },
      };
    }

    if (this.options.debug) {
      core.info(`Response: ${JSON.stringify(result, null, 2)}`);
    }

    return result;
  }

  public startScan(
    request: StartSbomScanRequest
  ): Promise<ApiResponse<StartSbomScanResponse, ApiErrorResponse>> {
    return this.fetchWithRetries(`${this.apiBaseUrl}/v1/sbom/scan/upload`, {
      method: "POST",
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
  }

  public getScanResult(
    scanId: string
  ): Promise<ApiResponse<SbomScanResult, ApiErrorResponse>> {
    return this.fetchWithRetries(
      `${this.apiBaseUrl}/v1/sbom/scan/${scanId}/status`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${this.apiToken}`,
        },
      }
    );
  }

  public async uploadSbom(
    uploadUrl: string,
    sbom: Sbom
  ): Promise<UploadSbomResponse> {
    return this.fetchWithRetries(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sbom),
    });
  }
}
