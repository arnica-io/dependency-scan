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

test("setOutput propagates file write errors so CI fails", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gl-arnica-"));
  process.env.CI_PROJECT_DIR = tmp;
  const originalAppendFileSync = fs.appendFileSync;

  fs.appendFileSync = () => {
    throw new Error("disk-full");
  };

  try {
    const platform = new GitLabCIPlatform();
    assert.throws(() => platform.setOutput("status", "Success"), /disk-full/);
  } finally {
    fs.appendFileSync = originalAppendFileSync;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("writeSummary propagates file write errors so CI fails", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gl-arnica-"));
  process.env.CI_PROJECT_DIR = tmp;
  const platform = new GitLabCIPlatform();
  const originalWriteFile = fsPromises.writeFile;

  fsPromises.writeFile = async () => {
    throw new Error("summary-write-failed");
  };

  try {
    await assert.rejects(
      () => platform.writeSummary("line-1\n"),
      /summary-write-failed/
    );
  } finally {
    fsPromises.writeFile = originalWriteFile;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
