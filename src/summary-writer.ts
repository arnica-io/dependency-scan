import { FindingSeverity, SbomScanResult } from "./api";
import { Platform } from "./platform/platform";

const FindingSeverityLabel: Record<FindingSeverity, string> = {
  critical: "🔴 Critical",
  high: "🟠 High",
  medium: "🟡 Medium",
  low: "🔵 Low",
};

function markdownTable(
  headers: string[],
  rows: string[][]
): string {
  const headerRow = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const dataRows = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  return `${headerRow}\n${separator}\n${dataRows}\n`;
}

export class SummaryWriter {
  private constructor() {}

  public static async writeSummary(
    platform: Platform,
    message: string,
    findingsSummary?: SbomScanResult["findingsSummary"]
  ): Promise<void> {
    let markdown = `# Summary\n\n${message}\n\n`;

    if (!findingsSummary || findingsSummary.total === 0) {
      await platform.writeSummary(markdown);
      return;
    }

    markdown += `# Findings\n\n`;
    markdown += markdownTable(
      ["Severity", "Total"],
      FindingSeverity.map((severity) => [
        FindingSeverityLabel[severity],
        findingsSummary[severity].toString(),
      ])
    );
    markdown += "\n";

    for (const severity of FindingSeverity) {
      if (findingsSummary[severity] > 0) {
        markdown += `## ${FindingSeverityLabel[severity]} Findings (${findingsSummary[severity]})\n\n`;
        markdown += markdownTable(
          ["Title", "Finding Type", "Status", "Recommendation"],
          findingsSummary.findings
            .filter((finding) => finding.severity === severity)
            .map((finding) => [
              finding.title,
              finding.type,
              finding.status
                .split("_")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" "),
              finding.recommendation?.description ??
                "No specific fix available",
            ])
        );
        markdown += "\n";
      }
    }

    await platform.writeSummary(markdown);
  }
}
