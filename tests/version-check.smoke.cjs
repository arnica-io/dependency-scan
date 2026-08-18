"use strict";

const { getUpdateLogMessage } = require("../dist/version-check");

async function main() {
  const message = await getUpdateLogMessage({ actionRef: "0.0.1" });
  if (!message || !message.includes("Update available")) {
    console.error("expected update message for 0.0.1 vs npm latest, got:", message);
    process.exit(1);
  }
  console.log(message);
}

main();
