#!/usr/bin/env node

import { getValidatedInput } from "./input";
import { DependencyScanAction } from "./scan-action";

async function main(): Promise<void> {
  const isGitHub = !!process.env.GITHUB_ACTIONS;

  const platform = isGitHub
    ? new (await import("./platform/github")).GitHubActionsPlatform()
    : new (await import("./platform/azure-devops")).AzureDevOpsPlatform();

  const input = getValidatedInput(platform);
  await new DependencyScanAction(input, platform).run();
}

main();
