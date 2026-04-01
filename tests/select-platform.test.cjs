"use strict";

const { test } = require("node:test");
const assert = require("node:assert");

const { selectPlatform, isBitbucketEnvironment } = require(
  "../dist/platform/select-platform"
);
const { GitHubActionsPlatform } = require("../dist/platform/github");
const { BitbucketPipelinesPlatform } = require(
  "../dist/platform/bitbucket-pipelines"
);
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

test("selectPlatform falls back to Azure when no GitHub/Bitbucket markers", () => {
  const platform = selectPlatform({});
  assert.ok(platform instanceof AzureDevOpsPlatform);
});

test("isBitbucketEnvironment returns true for BITBUCKET_BRANCH_NAME-only", () => {
  const isBitbucket = isBitbucketEnvironment({
    BITBUCKET_BRANCH_NAME: "feature/branch-only",
  });
  assert.strictEqual(isBitbucket, true);
});
