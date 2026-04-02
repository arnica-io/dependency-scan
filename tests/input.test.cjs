"use strict";

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const { getValidatedInput } = require("../dist/input");

const bitbucketEnvKeys = [
  "REPOSITORY_URL",
  "BRANCH",
  "SCAN_PATH",
  "API_BASE_URL",
  "API_TOKEN",
  "SCAN_TIMEOUT_SECONDS",
  "ON_FINDINGS",
  "DEBUG",
  "ARNICA_DEBUG_MODE",
  "GITHUB_ACTIONS",
  "GITHUB_REPOSITORY",
  "GITHUB_SERVER_URL",
  "GITHUB_REF",
  "GITHUB_REF_NAME",
  "GITHUB_HEAD_REF",
  "TF_BUILD",
  "BUILD_BUILDID",
  "INPUT_REPOSITORY_URL",
  "INPUT_BRANCH",
  "INPUT_SCAN_PATH",
  "INPUT_API_BASE_URL",
  "INPUT_API_TOKEN",
  "INPUT_SCAN_TIMEOUT_SECONDS",
  "INPUT_ON_FINDINGS",
  "INPUT_DEBUG",
  "ARNICA_REPOSITORY_URL",
  "ARNICA_BRANCH",
  "ARNICA_SCAN_PATH",
  "ARNICA_SCAN_TIMEOUT_SECONDS",
  "ARNICA_ON_FINDINGS",
  "ARNICA_DEBUG",
  "ARNICA_API_TOKEN",
  "BUILD_REPOSITORY_URI",
  "BUILD_SOURCEBRANCHNAME",
  "BITBUCKET_PIPELINE_UUID",
  "BITBUCKET_CLONE_DIR",
  "BITBUCKET_GIT_HTTP_ORIGIN",
  "BITBUCKET_GIT_SSH_ORIGIN",
  "BITBUCKET_BRANCH",
  "BITBUCKET_PR_SOURCE_BRANCH",
  "BITBUCKET_SOURCE_BRANCH",
  "BITBUCKET_BRANCH_NAME",
  "BITBUCKET_REPO_FULL_NAME",
  "BITBUCKET_WORKSPACE",
  "BITBUCKET_REPO_OWNER",
  "BITBUCKET_REPO_SLUG",
  "BITBUCKET_SERVER_URL",
  "BITBUCKET_BASE_URL",
];

function clearTestEnv() {
  for (const key of bitbucketEnvKeys) {
    delete process.env[key];
  }
}

function createPlatform() {
  return {
    info: () => {},
    error: () => {},
    setOutput: () => {},
    setFailed: () => {},
    runCommand: async () => {},
    getWorkspacePath: () => "/tmp/workspace",
    writeSummary: async () => {},
  };
}

beforeEach(() => {
  clearTestEnv();
});

afterEach(() => {
  clearTestEnv();
});

test("getValidatedInput uses Bitbucket Cloud URL and branch fallbacks", () => {
  process.env.BITBUCKET_PIPELINE_UUID = "{uuid}";
  process.env.BITBUCKET_GIT_HTTP_ORIGIN =
    "https://user:pass@bitbucket.org/acme/demo-repo.git";
  process.env.BITBUCKET_BRANCH = "feature/branch";
  process.env.ARNICA_API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://bitbucket.org/acme/demo-repo.git");
  assert.strictEqual(input.branch, "feature/branch");
});

test("getValidatedInput normalizes Bitbucket Cloud http URL to https", () => {
  process.env.BITBUCKET_PIPELINE_UUID = "{uuid}";
  process.env.BITBUCKET_GIT_HTTP_ORIGIN = "http://bitbucket.org/acme/http-repo.git";
  process.env.BITBUCKET_BRANCH = "master";
  process.env.ARNICA_API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://bitbucket.org/acme/http-repo.git");
});

test("getValidatedInput normalizes Bitbucket Cloud ssh URL to https", () => {
  process.env.BITBUCKET_PIPELINE_UUID = "{uuid}";
  process.env.BITBUCKET_GIT_SSH_ORIGIN = "git@bitbucket.org:acme/ssh-repo.git";
  process.env.BITBUCKET_BRANCH = "master";
  process.env.ARNICA_API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://bitbucket.org/acme/ssh-repo.git");
});

test("getValidatedInput derives Bitbucket Server repo URL from server + full name", () => {
  process.env.BITBUCKET_CLONE_DIR = "/opt/atlassian/pipelines/agent/build";
  process.env.BITBUCKET_SERVER_URL = "https://bitbucket.company.local/";
  process.env.BITBUCKET_REPO_FULL_NAME = "team/project";
  process.env.BITBUCKET_PR_SOURCE_BRANCH = "feature/pr-source";
  process.env.ARNICA_API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(
    input.repoUrl,
    "https://bitbucket.company.local/scm/team/project.git"
  );
  assert.strictEqual(input.branch, "feature/pr-source");
});

test("getValidatedInput derives Bitbucket Cloud repo URL from workspace and slug", () => {
  process.env.BITBUCKET_PIPELINE_UUID = "{uuid}";
  process.env.BITBUCKET_WORKSPACE = "shtrull";
  process.env.BITBUCKET_REPO_SLUG = "argo-cd";
  process.env.BITBUCKET_BRANCH = "master";
  process.env.ARNICA_API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://bitbucket.org/shtrull/argo-cd");
  assert.strictEqual(input.branch, "master");
});

test("getValidatedInput treats workspace and slug as Bitbucket CI without pipeline UUID", () => {
  process.env.BITBUCKET_WORKSPACE = "shtrull";
  process.env.BITBUCKET_REPO_SLUG = "argo-cd";
  process.env.BITBUCKET_BRANCH = "master";
  process.env.ARNICA_API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://bitbucket.org/shtrull/argo-cd");
  assert.strictEqual(input.branch, "master");
});

test("getValidatedInput derives GitHub repository URL and branch from env", () => {
  process.env.GITHUB_ACTIONS = "true";
  process.env.GITHUB_SERVER_URL = "https://github.com";
  process.env.GITHUB_REPOSITORY = "arnica-io/dependency-scan";
  process.env.GITHUB_REF_NAME = "feature/gh-branch";
  process.env.ARNICA_API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://github.com/arnica-io/dependency-scan");
  assert.strictEqual(input.branch, "feature/gh-branch");
});

test("getValidatedInput supports generic CLI env names", () => {
  process.env.REPOSITORY_URL = "https://bitbucket.org/acme/alias-repo";
  process.env.BRANCH = "feature/alias-branch";
  process.env.SCAN_PATH = "services/payments";
  process.env.SCAN_TIMEOUT_SECONDS = "1200";
  process.env.ON_FINDINGS = "alert";
  process.env.ARNICA_DEBUG_MODE = "true";
  process.env.API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://bitbucket.org/acme/alias-repo");
  assert.strictEqual(input.branch, "feature/alias-branch");
  assert.strictEqual(input.scanPath, "services/payments");
  assert.strictEqual(input.scanTimeoutSeconds, 1200);
  assert.strictEqual(input.onFindings, "alert");
  assert.strictEqual(input.debug, true);
});

test("getValidatedInput does not enable debug from generic DEBUG env alone", () => {
  process.env.REPOSITORY_URL = "https://bitbucket.org/acme/alias-repo";
  process.env.DEBUG = "true";
  process.env.API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.debug, false);
});

test("getValidatedInput keeps legacy INPUT_* compatibility", () => {
  process.env.INPUT_REPOSITORY_URL = "https://github.com/arnica-io/dependency-scan";
  process.env.INPUT_BRANCH = "legacy-input-branch";
  process.env.INPUT_SCAN_PATH = "legacy/path";
  process.env.INPUT_SCAN_TIMEOUT_SECONDS = "777";
  process.env.INPUT_ON_FINDINGS = "pass";
  process.env.INPUT_DEBUG = "true";
  process.env.INPUT_API_TOKEN = "legacy-token";
  process.env.INPUT_API_BASE_URL = "https://api.app.arnica.io";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://github.com/arnica-io/dependency-scan");
  assert.strictEqual(input.branch, "legacy-input-branch");
  assert.strictEqual(input.scanPath, "legacy/path");
  assert.strictEqual(input.scanTimeoutSeconds, 777);
  assert.strictEqual(input.onFindings, "pass");
  assert.strictEqual(input.debug, true);
  assert.strictEqual(input.apiToken, "legacy-token");
  assert.strictEqual(input.apiBaseUrl, "https://api.app.arnica.io");
});

test("getValidatedInput gives INPUT_* precedence over generic names", () => {
  process.env.REPOSITORY_URL = "https://bitbucket.org/acme/generic-repo";
  process.env.BRANCH = "generic-branch";
  process.env.SCAN_PATH = "generic/path";
  process.env.SCAN_TIMEOUT_SECONDS = "111";
  process.env.ON_FINDINGS = "alert";
  process.env.DEBUG = "false";
  process.env.API_TOKEN = "generic-token";
  process.env.API_BASE_URL = "https://api.staging.notaloevera.io";

  process.env.INPUT_REPOSITORY_URL = "https://github.com/arnica-io/input-repo";
  process.env.INPUT_BRANCH = "input-branch";
  process.env.INPUT_SCAN_PATH = "input/path";
  process.env.INPUT_SCAN_TIMEOUT_SECONDS = "222";
  process.env.INPUT_ON_FINDINGS = "fail";
  process.env.INPUT_DEBUG = "true";
  process.env.INPUT_API_TOKEN = "input-token";
  process.env.INPUT_API_BASE_URL = "https://api.app.arnica.io";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.repoUrl, "https://github.com/arnica-io/input-repo");
  assert.strictEqual(input.branch, "input-branch");
  assert.strictEqual(input.scanPath, "input/path");
  assert.strictEqual(input.scanTimeoutSeconds, 222);
  assert.strictEqual(input.onFindings, "fail");
  assert.strictEqual(input.debug, true);
  assert.strictEqual(input.apiToken, "input-token");
  assert.strictEqual(input.apiBaseUrl, "https://api.app.arnica.io");
});

test("getValidatedInput prefers GitHub head ref for pull request context", () => {
  process.env.GITHUB_ACTIONS = "true";
  process.env.GITHUB_SERVER_URL = "https://github.com";
  process.env.GITHUB_REPOSITORY = "arnica-io/dependency-scan";
  process.env.GITHUB_REF_NAME = "main";
  process.env.GITHUB_HEAD_REF = "feature/from-pr";
  process.env.ARNICA_API_TOKEN = "token";

  const input = getValidatedInput(createPlatform());

  assert.strictEqual(input.branch, "feature/from-pr");
});

test("getValidatedInput fails fast in Bitbucket environment without resolvable repo URL", () => {
  process.env.BITBUCKET_PIPELINE_UUID = "{uuid}";
  process.env.BITBUCKET_BRANCH = "main";
  process.env.ARNICA_API_TOKEN = "token";

  assert.throws(
    () => {
      getValidatedInput(createPlatform());
    },
    (error) => {
      assert.match(
        error.message,
        /Repository URL is missing in CI environment/
      );
      return true;
    }
  );
});

test("getValidatedInput treats BITBUCKET_BRANCH_NAME-only as Bitbucket environment", () => {
  process.env.BITBUCKET_BRANCH_NAME = "feature/branch-name-only";
  process.env.ARNICA_API_TOKEN = "token";

  assert.throws(
    () => {
      getValidatedInput(createPlatform());
    },
    (error) => {
      assert.match(
        error.message,
        /Repository URL is missing in CI environment/
      );
      return true;
    }
  );
});

test("getValidatedInput fails fast in GitHub environment without resolvable repo URL", () => {
  process.env.GITHUB_ACTIONS = "true";
  process.env.GITHUB_REF_NAME = "main";
  process.env.ARNICA_API_TOKEN = "token";

  assert.throws(
    () => {
      getValidatedInput(createPlatform());
    },
    (error) => {
      assert.match(
        error.message,
        /Repository URL is missing in CI environment/
      );
      return true;
    }
  );
});

test("getValidatedInput fails fast when API token is unresolved placeholder", () => {
  process.env.BITBUCKET_PIPELINE_UUID = "{uuid}";
  process.env.BITBUCKET_GIT_HTTP_ORIGIN = "https://bitbucket.org/acme/demo-repo.git";
  process.env.BITBUCKET_BRANCH = "main";
  process.env.ARNICA_API_TOKEN = "$ARNICA_API_TOKEN";

  assert.throws(
    () => {
      getValidatedInput(createPlatform());
    },
    (error) => {
      assert.match(
        error.message,
        /unresolved variable placeholder/
      );
      return true;
    }
  );
});
