import { spawn } from "child_process";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { Platform } from "./platform";

/**
 * Bitbucket Pipelines has no first-class step outputs like GitHub Actions or Azure DevOps.
 * We persist key/value lines under the clone dir for optional sourcing or artifacts.
 * Agentic Rule (ARNIE_PATH_PATH_BUILDING): Join outputs file only under BITBUCKET_CLONE_DIR workspace root
 */
export class BitbucketPipelinesPlatform implements Platform {
  private summaryContent = "";
  private didWarnMissingWorkspace = false;
  private didInitializeOutputsFile = false;

  private warnMissingWorkspace(context: string): void {
    if (this.didWarnMissingWorkspace) {
      return;
    }
    this.didWarnMissingWorkspace = true;
    console.warn(
      `Bitbucket workspace path is unavailable while ${context}. Set BITBUCKET_CLONE_DIR or INPUT_REPOSITORY_URL explicitly.`
    );
  }

  private getOutputsFilePath(): string {
    const ws = this.getWorkspacePath();
    if (!ws) {
      this.warnMissingWorkspace("writing outputs");
      return "";
    }
    return path.join(ws, ".arnica-scan-outputs.env");
  }

  info(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
  }

  setOutput(name: string, value: string): void {
    const sanitized = value.replace(/\r?\n/g, " ").trim();
    const line = `${name}=${sanitized}\n`;
    const outPath = this.getOutputsFilePath();
    if (outPath) {
      try {
        if (!this.didInitializeOutputsFile) {
          fs.writeFileSync(outPath, "", "utf-8");
          this.didInitializeOutputsFile = true;
        }
        fs.appendFileSync(outPath, line, "utf-8");
      } catch (error: unknown) {
        console.warn(
          `setOutput[bitbucket][${name}] failed to persist '${outPath}', switching to log-only output`,
          { error }
        );
        console.log(`ARNICA_OUTPUT ${name}=${sanitized} (log-only-fallback)`);
        return;
      }
    }
    console.log(`ARNICA_OUTPUT ${name}=${sanitized}`);
  }

  setFailed(message: string): void {
    console.error(message);
  }

  async runCommand(
    command: string,
    args: string[],
    options?: { cwd?: string }
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options?.cwd,
        stdio: "inherit",
        shell: false,
      });
      child.on("error", reject);
      child.on("close", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `Command exited with code ${code ?? "null"}, signal ${signal ?? "null"}`
          )
        );
      });
    });
  }

  getWorkspacePath(): string {
    return process.env.BITBUCKET_CLONE_DIR || "";
  }

  async writeSummary(markdown: string): Promise<void> {
    this.summaryContent += markdown;
    const trimmedMarkdown = markdown.trim();
    if (trimmedMarkdown) {
      console.log("========== Arnica Scan Summary ==========");
      console.log(trimmedMarkdown);
      console.log("========================================");
    }

    const ws = this.getWorkspacePath();
    if (!ws) {
      this.warnMissingWorkspace("writing summary");
      return;
    }

    const summaryPath = path.join(ws, "arnica-scan-summary.md");
    await fsPromises.writeFile(summaryPath, this.summaryContent, "utf-8");
    console.log(
      `Arnica scan summary written to ${summaryPath}. Add this file to your pipeline artifacts if you want to retain it.`
    );
  }
}
