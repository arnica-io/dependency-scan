import * as core from "@actions/core";
import { exec as ghActionsExec } from "@actions/exec";
import { Platform } from "./platform";

export class GitHubActionsPlatform implements Platform {
  info(message: string): void {
    core.info(message);
  }

  error(message: string): void {
    core.error(message);
  }

  setOutput(name: string, value: string): void {
    core.setOutput(name, value);
  }

  setFailed(message: string): void {
    core.setFailed(message);
  }

  async runCommand(
    command: string,
    args: string[],
    options?: { cwd?: string }
  ): Promise<void> {
    await ghActionsExec(command, args, options);
  }

  getWorkspacePath(): string {
    return process.env.GITHUB_WORKSPACE || "";
  }

  async writeSummary(markdown: string): Promise<void> {
    await core.summary.addRaw(markdown).write();
  }
}
