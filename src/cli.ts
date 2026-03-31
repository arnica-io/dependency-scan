#!/usr/bin/env node

import { getValidatedInput } from "./input";
import { DependencyScanAction } from "./scan-action";
import { GitHubActionsPlatform } from "./platform/github";
import { AzureDevOpsPlatform } from "./platform/azure-devops";

async function main(): Promise<void> {
  const isGitHub = !!process.env.GITHUB_ACTIONS;

  const platform = isGitHub
    ? new GitHubActionsPlatform()
    : new AzureDevOpsPlatform();

  const input = getValidatedInput(platform);
  await new DependencyScanAction(input, platform).run();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
