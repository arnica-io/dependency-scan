import { AzureDevOpsPlatform } from "./platform/azure-devops";
import { getValidatedInput } from "./input";
import { DependencyScanAction } from "./scan-action";

const platform = new AzureDevOpsPlatform();
const input = getValidatedInput(platform);
new DependencyScanAction(input, platform).run();
