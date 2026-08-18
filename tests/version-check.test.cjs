"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

const {
  parseSemver,
  isNewerVersion,
  getUpdateLogMessage,
} = require("../dist/version-check");

function jsonResponse(body, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

test("parseSemver accepts v-prefixed and plain versions", () => {
  assert.deepStrictEqual(parseSemver("v1.2.3"), [1, 2, 3]);
  assert.deepStrictEqual(parseSemver("1.2.3"), [1, 2, 3]);
  assert.strictEqual(parseSemver("v1"), undefined);
  assert.strictEqual(parseSemver("abc"), undefined);
});

test("isNewerVersion compares major.minor.patch", () => {
  assert.strictEqual(isNewerVersion("1.0.33", "1.0.32"), true);
  assert.strictEqual(isNewerVersion("1.1.0", "1.0.33"), true);
  assert.strictEqual(isNewerVersion("2.0.0", "1.9.9"), true);
  assert.strictEqual(isNewerVersion("1.0.33", "1.0.33"), false);
  assert.strictEqual(isNewerVersion("1.0.32", "1.0.33"), false);
});

test("getUpdateLogMessage logs when npm latest is newer than current tag", async () => {
  const message = await getUpdateLogMessage({
    actionRef: "v1.0.32",
    fetchFn: async (url) => {
      assert.match(String(url), /registry\.npmjs\.org/);
      return jsonResponse({ version: "1.0.33" });
    },
  });
  assert.strictEqual(
    message,
    "Update available: @arnica-io/dependency-scan@1.0.33 (current: 1.0.32)"
  );
});

test("getUpdateLogMessage is silent when current matches latest", async () => {
  const message = await getUpdateLogMessage({
    packageVersion: "1.0.33",
    fetchFn: async () => jsonResponse({ version: "1.0.33" }),
  });
  assert.strictEqual(message, undefined);
});

test("getUpdateLogMessage is silent when fetch fails", async () => {
  const message = await getUpdateLogMessage({
    packageVersion: "1.0.1",
    fetchFn: async () => {
      throw new Error("network down");
    },
  });
  assert.strictEqual(message, undefined);
});

test("getUpdateLogMessage skips moving major tags", async () => {
  let fetchCalls = 0;
  const message = await getUpdateLogMessage({
    actionRef: "v1",
    fetchFn: async () => {
      fetchCalls += 1;
      return jsonResponse({ version: "1.0.33" });
    },
  });
  assert.strictEqual(message, undefined);
  assert.strictEqual(fetchCalls, 0);
});

test("getUpdateLogMessage logs when pinned SHA is not the latest release commit", async () => {
  const currentSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const latestSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const message = await getUpdateLogMessage({
    actionRef: currentSha,
    fetchFn: async (url) => {
      const href = String(url);
      if (href.includes("registry.npmjs.org")) {
        return jsonResponse({ version: "1.0.33" });
      }
      if (href.includes("/commits/v1.0.33")) {
        return jsonResponse({ sha: latestSha });
      }
      throw new Error(`unexpected url ${href}`);
    },
  });
  assert.strictEqual(
    message,
    "Update available: @arnica-io/dependency-scan@1.0.33 (current: aaaaaaaaaaaa)"
  );
});

test("getUpdateLogMessage uses ARNICA_ACTION_REF when no actionRef dep is passed", async () => {
  process.env.ARNICA_ACTION_REF = "v1.0.32";
  try {
    const message = await getUpdateLogMessage({
      fetchFn: async () => jsonResponse({ version: "1.0.33" }),
    });
    assert.strictEqual(
      message,
      "Update available: @arnica-io/dependency-scan@1.0.33 (current: 1.0.32)"
    );
  } finally {
    delete process.env.ARNICA_ACTION_REF;
  }
});

test("getUpdateLogMessage handles v-prefixed npm latest on SHA path", async () => {
  const currentSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const latestSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const message = await getUpdateLogMessage({
    actionRef: currentSha,
    fetchFn: async (url) => {
      const href = String(url);
      if (href.includes("registry.npmjs.org")) {
        return jsonResponse({ version: "v1.0.33" });
      }
      assert.match(href, /\/commits\/v1\.0\.33$/);
      return jsonResponse({ sha: latestSha });
    },
  });
  assert.strictEqual(
    message,
    "Update available: @arnica-io/dependency-scan@1.0.33 (current: aaaaaaaaaaaa)"
  );
});

test("getUpdateLogMessage is silent when pinned SHA matches latest release", async () => {
  const latestSha = "cccccccccccccccccccccccccccccccccccccccc";
  const message = await getUpdateLogMessage({
    actionRef: latestSha,
    fetchFn: async (url) => {
      const href = String(url);
      if (href.includes("registry.npmjs.org")) {
        return jsonResponse({ version: "1.0.33" });
      }
      return jsonResponse({ sha: latestSha });
    },
  });
  assert.strictEqual(message, undefined);
});
