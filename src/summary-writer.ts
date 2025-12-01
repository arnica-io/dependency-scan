import { FindingSeverity, SbomScanResult } from "./api";
import * as core from "@actions/core";

const FindingSeverityLabel: Record<FindingSeverity, string> = {
  critical: "🔴 Critical",
  high: "🟠 High",
  medium: "🟡 Medium",
  low: "🔵 Low",
};

export class SummaryWriter {
  private constructor() {}

  public static async writeSummary(
    message: string,
    findingsSummary?: SbomScanResult["findingsSummary"]
  ): Promise<void> {
    await core.summary.addHeading("Summary").addRaw(message).write();

    if (!findingsSummary || findingsSummary.total === 0) {
      return;
    }

    /** Print table of finding severity counts **/
    await core.summary
      .addHeading("Findings")
      .addTable([
        [
          { data: "Severity", header: true },
          { data: "Total", header: true },
        ],
        ...FindingSeverity.map((severity) => [
          { data: FindingSeverityLabel[severity] },
          { data: findingsSummary[severity].toString() },
        ]),
      ])
      .write();

    /** Print tables of individual findings by severity **/
    for (const severity of FindingSeverity) {
      if (findingsSummary[severity] > 0) {
        await core.summary
          .addHeading(
            `${FindingSeverityLabel[severity]} Findings (${findingsSummary[severity]})`,
            2
          )
          .addTable([
            [
              { data: "Title", header: true },
              { data: "Finding Type", header: true },
              { data: "Status", header: true },
              { data: "Recommendation", header: true },
            ],
            ...findingsSummary.findings
              .filter((finding) => finding.severity === severity)
              .map((finding) => [
                finding.title,
                finding.type,
                // E.g. "requires_review" -> "Requires Review"
                finding.status
                  .split("_")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" "),
                finding.recommendation?.description ??
                  "No specific fix available",
              ]),
          ])
          .write();
      }
    }
  }
}
