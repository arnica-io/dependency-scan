"use strict";

const { test, afterEach } = require("node:test");
const assert = require("node:assert");

const { getValidatedInput } = require("../dist/input");

const bitbucketEnvKeys = [
  "INPUT_REPOSITORY_URL",
  "INPUT_BRANCH",
  "INPUT_SCAN_PATH",
  "INPUT_API_BASE_URL",
  "INPUT_API_TOKEN",
  "INPUT_SCAN_TIMEOUT_SECONDS",
  "INPUT_ON_FINDINGS",
  "INPUT_DEBUG",
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
        /Repository URL is missing in Bitbucket environment/
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
        /Repository URL is missing in Bitbucket environment/
      );
      return true;
    }
  );
});
