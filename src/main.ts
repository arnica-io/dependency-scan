import { DependencyScanInput, getValidatedInput } from "./input";
import { DependencyScanAction } from "./scan-action";

const input: DependencyScanInput = getValidatedInput();
new DependencyScanAction(input).run();
