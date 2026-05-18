"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

const {
  selectPlatform,
  isAzureEnvironment,
  isBitbucketEnvironment,
  isGitHubEnvironment,
  isGitLabEnvironment,
} = require("../dist/platform/select-platform");
const { GitHubActionsPlatform } = require("../dist/platform/github");
const { BitbucketPipelinesPlatform } = require(
  "../dist/platform/bitbucket-pipelines"
);
const { GitLabCIPlatform } = require("../dist/platform/gitlab-ci");
const { AzureDevOpsPlatform } = require("../dist/platform/azure-devops");

test("selectPlatform prefers GitHub when GitHub and Bitbucket env vars coexist", () => {
  const platform = selectPlatform({
    GITHUB_ACTIONS: "true",
    BITBUCKET_PIPELINE_UUID: "{uuid}",
  });
  assert.ok(platform instanceof GitHubActionsPlatform);
});

test("selectPlatform picks Bitbucket with pipeline UUID", () => {
  const platform = selectPlatform({
    BITBUCKET_PIPELINE_UUID: "{uuid}",
  });
  assert.ok(platform instanceof BitbucketPipelinesPlatform);
});

test("selectPlatform picks Bitbucket with repo full name only", () => {
  const platform = selectPlatform({
    BITBUCKET_REPO_FULL_NAME: "team/repo",
  });
  assert.ok(platform instanceof BitbucketPipelinesPlatform);
});

test("selectPlatform picks Azure when ADO env markers are present", () => {
  const platform = selectPlatform({ TF_BUILD: "True" });
  assert.ok(platform instanceof AzureDevOpsPlatform);
});

test("selectPlatform picks Azure when BUILD_REPOSITORY_URI is set", () => {
  const platform = selectPlatform({
    BUILD_REPOSITORY_URI: "https://dev.azure.com/org/_git/repo",
  });
  assert.ok(platform instanceof AzureDevOpsPlatform);
});

test("selectPlatform throws when no supported CI platform markers are present", () => {
  assert.throws(
    () => selectPlatform({}),
    /No supported CI platform detected/
  );
});

test("isAzureEnvironment returns true for TF_BUILD", () => {
  assert.strictEqual(isAzureEnvironment({ TF_BUILD: "True" }), true);
});

test("isAzureEnvironment returns true for BUILD_BUILDID", () => {
  assert.strictEqual(isAzureEnvironment({ BUILD_BUILDID: "123" }), true);
});

test("isAzureEnvironment returns false for empty env", () => {
  assert.strictEqual(isAzureEnvironment({}), false);
});

test("selectPlatform picks Bitbucket with workspace and slug only", () => {
  const platform = selectPlatform({
    BITBUCKET_WORKSPACE: "acme",
    BITBUCKET_REPO_SLUG: "demo",
  });
  assert.ok(platform instanceof BitbucketPipelinesPlatform);
});

test("selectPlatform picks Bitbucket with repo owner and slug only", () => {
  const platform = selectPlatform({
    BITBUCKET_REPO_OWNER: "acme",
    BITBUCKET_REPO_SLUG: "demo",
  });
  assert.ok(platform instanceof BitbucketPipelinesPlatform);
});

test("selectPlatform picks GitHub when repository env exists", () => {
  const platform = selectPlatform({
    GITHUB_REPOSITORY: "arnica-io/dependency-scan",
    GITHUB_SERVER_URL: "https://github.com",
  });
  assert.ok(platform instanceof GitHubActionsPlatform);
});

test("isBitbucketEnvironment returns true for BITBUCKET_BRANCH_NAME-only", () => {
  const isBitbucket = isBitbucketEnvironment({
    BITBUCKET_BRANCH_NAME: "feature/branch-only",
  });
  assert.strictEqual(isBitbucket, true);
});

test("isGitHubEnvironment returns true when GITHUB_REPOSITORY is set", () => {
  assert.strictEqual(
    isGitHubEnvironment({
      GITHUB_REPOSITORY: "acme/demo",
    }),
    true
  );
});

test("isGitHubEnvironment returns false for empty env", () => {
  assert.strictEqual(isGitHubEnvironment({}), false);
});

// --- GitLab detection tests ---

test("isGitLabEnvironment returns true for GITLAB_CI only", () => {
  assert.strictEqual(isGitLabEnvironment({ GITLAB_CI: "true" }), true);
});

test("isGitLabEnvironment returns true when both CI_PROJECT_DIR and CI_PIPELINE_ID are set", () => {
  assert.strictEqual(
    isGitLabEnvironment({ CI_PROJECT_DIR: "/builds/org/repo", CI_PIPELINE_ID: "123456" }),
    true
  );
});

test("isGitLabEnvironment returns false for CI_PROJECT_DIR alone", () => {
  assert.strictEqual(isGitLabEnvironment({ CI_PROJECT_DIR: "/builds/org/repo" }), false);
});

test("isGitLabEnvironment returns false for CI_PIPELINE_ID alone", () => {
  assert.strictEqual(isGitLabEnvironment({ CI_PIPELINE_ID: "123456" }), false);
});

test("isGitLabEnvironment returns false for empty env", () => {
  assert.strictEqual(isGitLabEnvironment({}), false);
});

test("selectPlatform picks GitLab with GITLAB_CI", () => {
  const platform = selectPlatform({ GITLAB_CI: "true" });
  assert.ok(platform instanceof GitLabCIPlatform);
});

test("selectPlatform picks GitLab with CI_PROJECT_DIR and CI_PIPELINE_ID", () => {
  const platform = selectPlatform({ CI_PROJECT_DIR: "/builds/org/repo", CI_PIPELINE_ID: "123" });
  assert.ok(platform instanceof GitLabCIPlatform);
});

test("selectPlatform prefers GitHub over GitLab when both env vars coexist", () => {
  const platform = selectPlatform({
    GITHUB_ACTIONS: "true",
    GITLAB_CI: "true",
  });
  assert.ok(platform instanceof GitHubActionsPlatform);
});

test("selectPlatform prefers Bitbucket over GitLab when both env vars coexist", () => {
  const platform = selectPlatform({
    BITBUCKET_PIPELINE_UUID: "{uuid}",
    GITLAB_CI: "true",
  });
  assert.ok(platform instanceof BitbucketPipelinesPlatform);
});
