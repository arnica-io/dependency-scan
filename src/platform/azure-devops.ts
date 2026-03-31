import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { Platform } from "./platform";

export class AzureDevOpsPlatform implements Platform {
  private summaryContent = "";

  info(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
    // Azure Pipelines consumes ##vso commands from stdout; keep directive on stdout.
    console.log(`##vso[task.logissue type=error]${message}`);
  }

  setOutput(name: string, value: string): void {
    console.log(`##vso[task.setvariable variable=${name};isOutput=true]${value}`);
  }

  setFailed(message: string): void {
    console.error(message);
    console.log(`##vso[task.logissue type=error]${message}`);
    console.log(`##vso[task.complete result=Failed;]${message}`);
  }

  async runCommand(
    command: string,
    args: string[],
    options?: { cwd?: string }
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      execFile(
        command,
        args,
        {
          cwd: options?.cwd,
          stdio: "inherit",
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  getWorkspacePath(): string {
    return (
      process.env.BUILD_REPOSITORY_LOCALPATH ||
      process.env.BUILD_SOURCESDIRECTORY ||
      process.env.SYSTEM_DEFAULTWORKINGDIRECTORY ||
      ""
    );
  }

  async writeSummary(markdown: string): Promise<void> {
    this.summaryContent += markdown;

    const summaryDir =
      process.env.BUILD_ARTIFACTSTAGINGDIRECTORY || os.tmpdir();
    const summaryPath = path.join(summaryDir, "arnica-scan-summary.md");

    await fs.writeFile(summaryPath, this.summaryContent, "utf-8");
    console.log(`##vso[task.uploadsummary]${summaryPath}`);
  }
}
