import { AzureDevOpsPlatform } from "./azure-devops";
import { BitbucketPipelinesPlatform } from "./bitbucket-pipelines";
import { GitHubActionsPlatform } from "./github";
import { GitLabCIPlatform } from "./gitlab-ci";
import { Platform } from "./platform";

export function isGitHubEnvironment(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.GITHUB_ACTIONS ||
      env.GITHUB_REPOSITORY ||
      env.GITHUB_SERVER_URL ||
      env.GITHUB_REF ||
      env.GITHUB_REF_NAME ||
      env.GITHUB_HEAD_REF
  );
}

export function isBitbucketEnvironment(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.BITBUCKET_PIPELINE_UUID ||
      env.BITBUCKET_CLONE_DIR ||
      env.BITBUCKET_REPO_FULL_NAME ||
      env.BITBUCKET_WORKSPACE ||
      env.BITBUCKET_REPO_OWNER ||
      env.BITBUCKET_REPO_SLUG ||
      env.BITBUCKET_GIT_HTTP_ORIGIN ||
      env.BITBUCKET_GIT_SSH_ORIGIN ||
      env.BITBUCKET_BRANCH ||
      env.BITBUCKET_PR_SOURCE_BRANCH ||
      env.BITBUCKET_SOURCE_BRANCH ||
      env.BITBUCKET_BRANCH_NAME
  );
}

/**
 * GITLAB_CI is the canonical signal. The CI_PROJECT_DIR+CI_PIPELINE_ID
 * pair covers rare custom runner setups that omit GITLAB_CI; both must be
 * present to reduce false-positive risk from other CI systems.
 */
export function isGitLabEnvironment(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.GITLAB_CI || (env.CI_PROJECT_DIR && env.CI_PIPELINE_ID)
  );
}

export function selectPlatform(env: NodeJS.ProcessEnv): Platform {
  if (isGitHubEnvironment(env)) {
    return new GitHubActionsPlatform();
  }

  if (isBitbucketEnvironment(env)) {
    return new BitbucketPipelinesPlatform();
  }

  if (isGitLabEnvironment(env)) {
    return new GitLabCIPlatform();
  }

  return new AzureDevOpsPlatform();
}
