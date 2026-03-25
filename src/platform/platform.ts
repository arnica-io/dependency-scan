export interface Platform {
  info(message: string): void;
  error(message: string): void;
  setOutput(name: string, value: string): void;
  setFailed(message: string): void;
  runCommand(
    command: string,
    args: string[],
    options?: { cwd?: string }
  ): Promise<void>;
  getWorkspacePath(): string;
  writeSummary(markdown: string): Promise<void>;
}
