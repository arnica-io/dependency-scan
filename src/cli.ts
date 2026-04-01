#!/usr/bin/env node

import { getValidatedInput } from "./input";
import { selectPlatform } from "./platform/select-platform";
import { DependencyScanAction } from "./scan-action";

async function main(): Promise<void> {
  const platform = selectPlatform(process.env);
  const input = getValidatedInput(platform);
  await new DependencyScanAction(input, platform).run();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
