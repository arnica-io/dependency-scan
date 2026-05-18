import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { Platform } from "./platform";
import { runCommand } from "./run-command";

export class GitLabCIPlatform implements Platform {
  private summaryContent = "";
  private didWarnMissingWorkspace = false;

  private warnMissingWorkspace(context: string): void {
    if (this.didWarnMissingWorkspace) {
      return;
    }
    this.didWarnMissingWorkspace = true;
    console.warn(
      `GitLab workspace path is unavailable while ${context}. Ensure CI_PROJECT_DIR is set.`
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
      // appendFileSync creates the file if it does not exist; let failures
      // propagate so the CI run surfaces real disk/permission errors.
      fs.appendFileSync(outPath, line, "utf-8");
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
    await runCommand(command, args, options);
  }

  getWorkspacePath(): string {
    return process.env.CI_PROJECT_DIR || "";
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
