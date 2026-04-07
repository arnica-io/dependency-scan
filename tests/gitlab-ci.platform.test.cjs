"use strict";

const { test, afterEach } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");
const os = require("os");

const {
  GitLabCIPlatform,
} = require("../dist/platform/gitlab-ci");

afterEach(() => {
  delete process.env.CI_PROJECT_DIR;
});

test("getWorkspacePath uses CI_PROJECT_DIR", () => {
  process.env.CI_PROJECT_DIR = "/builds/org/repo";
  const platform = new GitLabCIPlatform();
  assert.strictEqual(platform.getWorkspacePath(), "/builds/org/repo");
});

test("getWorkspacePath returns empty string when CI_PROJECT_DIR is unset", () => {
  delete process.env.CI_PROJECT_DIR;
  const platform = new GitLabCIPlatform();
  assert.strictEqual(platform.getWorkspacePath(), "");
});

test("setOutput appends to .arnica-scan-outputs.env under project dir", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gl-arnica-"));
  process.env.CI_PROJECT_DIR = tmp;
  const platform = new GitLabCIPlatform();
  platform.setOutput("status", "Success");
  platform.setOutput("scan_id", "scan-123");
  const outFile = path.join(tmp, ".arnica-scan-outputs.env");
  const content = fs.readFileSync(outFile, "utf-8");
  assert.ok(content.includes("status=Success"));
  assert.ok(content.includes("scan_id=scan-123"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("setOutput resets stale outputs file for each new run instance", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gl-arnica-"));
  process.env.CI_PROJECT_DIR = tmp;
  const outFile = path.join(tmp, ".arnica-scan-outputs.env");
  fs.writeFileSync(outFile, "stale=value\n", "utf-8");

  const platform = new GitLabCIPlatform();
  platform.setOutput("status", "Success");

  const content = fs.readFileSync(outFile, "utf-8");
  assert.ok(content.includes("status=Success"));
  assert.ok(!content.includes("stale=value"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("setOutput sanitizes multiline values into one env line", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gl-arnica-"));
  process.env.CI_PROJECT_DIR = tmp;
  const platform = new GitLabCIPlatform();
  platform.setOutput("status", "ok\ninjected=value\r\n  ");

  const outFile = path.join(tmp, ".arnica-scan-outputs.env");
  const content = fs.readFileSync(outFile, "utf-8");
  assert.strictEqual(content, "status=ok injected=value\n");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("writeSummary writes markdown summary under project dir", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gl-arnica-"));
  process.env.CI_PROJECT_DIR = tmp;
  const platform = new GitLabCIPlatform();

  await platform.writeSummary("line-1\n");
  await platform.writeSummary("line-2\n");

  const summaryFile = path.join(tmp, "arnica-scan-summary.md");
  const content = fs.readFileSync(summaryFile, "utf-8");
  assert.strictEqual(content, "line-1\nline-2\n");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("missing workspace warns once and does not throw for outputs/summary", async () => {
  delete process.env.CI_PROJECT_DIR;
  const platform = new GitLabCIPlatform();
  const originalWarn = console.warn;
  const warnings = [];

  console.warn = (...args) => {
    warnings.push(args);
  };

  try {
    platform.setOutput("status", "Success");
    platform.setOutput("scan_id", "scan-123");
    await platform.writeSummary("line-1\n");
    await platform.writeSummary("line-2\n");
  } finally {
    console.warn = originalWarn;
  }

  assert.strictEqual(warnings.length, 1);
});

test("setOutput logs fallback warning when file write fails", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gl-arnica-"));
  process.env.CI_PROJECT_DIR = tmp;
  const originalWriteFileSync = fs.writeFileSync;
  const originalWarn = console.warn;
  const warnings = [];

  fs.writeFileSync = () => {
    throw new Error("disk-full");
  };
  console.warn = (...args) => {
    warnings.push(args);
  };

  try {
    const platform = new GitLabCIPlatform();
    platform.setOutput("status", "Success");
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    console.warn = originalWarn;
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  assert.ok(warnings.length >= 1);
  assert.match(String(warnings[0][0]), /switching to log-only output/);
});

test("writeSummary warns instead of crashing when file write fails", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gl-arnica-"));
  process.env.CI_PROJECT_DIR = tmp;
  const platform = new GitLabCIPlatform();
  const originalWriteFile = fsPromises.writeFile;
  const originalWarn = console.warn;
  const warnings = [];

  fsPromises.writeFile = async () => {
    throw new Error("summary-write-failed");
  };
  console.warn = (...args) => {
    warnings.push(args);
  };

  try {
    await platform.writeSummary("line-1\n");
  } finally {
    fsPromises.writeFile = originalWriteFile;
    console.warn = originalWarn;
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  assert.ok(warnings.length >= 1);
  assert.match(String(warnings[0][0]), /failed to write summary/);
});
