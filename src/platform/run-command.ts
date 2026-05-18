import { spawn } from "child_process";

/**
 * Shared spawn-based runner used by CI platforms that don't ship a richer
 * runner (Azure DevOps, Bitbucket Pipelines, GitLab CI). GitHub Actions uses
 * @actions/exec instead so it can pipe output through its annotation layer.
 *
 * Agentic Rule (ARNIE_RCE_COMMAND_EXECUTION): Use argument-array form with
 * shell:false so user-controlled args cannot be re-interpreted by a shell.
 */
export async function runCommand(
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
