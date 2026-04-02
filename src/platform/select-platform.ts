import { AzureDevOpsPlatform } from "./azure-devops";
import { BitbucketPipelinesPlatform } from "./bitbucket-pipelines";
import { GitHubActionsPlatform } from "./github";
import { Platform } from "./platform";

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

export function selectPlatform(env: NodeJS.ProcessEnv): Platform {
  const isGitHub = Boolean(
    env.GITHUB_ACTIONS ||
      env.GITHUB_REPOSITORY ||
      env.GITHUB_SERVER_URL ||
      env.GITHUB_REF ||
      env.GITHUB_REF_NAME ||
      env.GITHUB_HEAD_REF
  );
  if (isGitHub) {
    return new GitHubActionsPlatform();
  }

  if (isBitbucketEnvironment(env)) {
    return new BitbucketPipelinesPlatform();
  }

  return new AzureDevOpsPlatform();
}
