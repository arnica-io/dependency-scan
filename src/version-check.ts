import * as fs from "fs";
import * as path from "path";

const PACKAGE_NAME = "@arnica-io/dependency-scan";
const NPM_LATEST_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const GITHUB_COMMIT_URL_PREFIX =
  "https://api.github.com/repos/arnica-io/dependency-scan/commits/";
const VERSION_CHECK_TIMEOUT_MS = 3000;
const SHA_PATTERN = /^[0-9a-f]{40}$/iu;
const ALLOWED_URL_PREFIXES = [
  "https://registry.npmjs.org/@arnica-io/dependency-scan/",
  "https://api.github.com/repos/arnica-io/dependency-scan/",
] as const;

export interface VersionCheckDeps {
  readonly actionRef?: string;
  readonly packageVersion?: string;
  readonly githubToken?: string;
  readonly fetchFn?: typeof fetch;
}

type CurrentVersion =
  | { kind: "semver"; version: string }
  | { kind: "sha"; sha: string }
  | { kind: "skip" };

export function parseSemver(
  version: string
): [number, number, number] | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/u.exec(version.trim());
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(latest: string, current: string): boolean {
  const latestParts = parseSemver(latest);
  const currentParts = parseSemver(current);
  if (!latestParts || !currentParts) {
    return false;
  }
  if (latestParts[0] !== currentParts[0]) {
    return latestParts[0] > currentParts[0];
  }
  if (latestParts[1] !== currentParts[1]) {
    return latestParts[1] > currentParts[1];
  }
  return latestParts[2] > currentParts[2];
}

function formatSemver(parts: [number, number, number]): string {
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

function classifyRef(ref: string): CurrentVersion {
  // Agentic Rule (ARNIE_INPUT_SCHEMA_VALIDATION): Accept only semver or 40-char SHA from action_ref.
  const normalized = ref.trim();
  const semver = parseSemver(normalized);
  if (semver) {
    return { kind: "semver", version: formatSemver(semver) };
  }
  if (SHA_PATTERN.test(normalized)) {
    return { kind: "sha", sha: normalized.toLowerCase() };
  }
  return { kind: "skip" };
}

function readInstalledVersion(): string | undefined {
  try {
    // Agentic Rule (ARNIE_PATH_PATH_BUILDING): Resolve package.json from this module, not user input.
    const pkgPath = path.join(__dirname, "..", "package.json");
    const parsed = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return parsed.version;
  } catch {
    return undefined;
  }
}

function resolveCurrentVersion(deps: VersionCheckDeps): CurrentVersion {
  const actionRef = deps.actionRef ?? process.env.ARNICA_ACTION_REF ?? process.env.GITHUB_ACTION_REF;
  if (actionRef) {
    return classifyRef(actionRef);
  }

  const packageVersion = deps.packageVersion ?? readInstalledVersion();
  if (!packageVersion) {
    return { kind: "skip" };
  }
  return classifyRef(packageVersion);
}

function assertAllowedUrl(url: string): void {
  // Agentic Rule (ARNIE_SSRF_URL_VALIDATION): Only hardcoded npm/GitHub URLs; reject anything else.
  // Agentic Rule (ARNIE_SSRF_DOMAIN_ALLOWLIST): registry.npmjs.org and api.github.com only.
  // Agentic Rule (ARNIE_SSRF_PROTOCOL_RESTRICTIONS): HTTPS prefixes only.
  if (!ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    throw new Error("Blocked unexpected version-check URL");
  }
}

async function fetchJson<T>(
  url: string,
  deps: VersionCheckDeps
): Promise<T | undefined> {
  assertAllowedUrl(url);

  const fetchFn = deps.fetchFn ?? fetch;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (url.startsWith("https://api.github.com/")) {
    headers.Accept = "application/vnd.github+json";
    headers["User-Agent"] = "arnica-io-dependency-scan";
    // Agentic Rule (ARNIE_SECRET_ENVIRONMENT_USAGE): Read GITHUB_TOKEN from env only; never hardcode.
    // Agentic Rule (ARNIE_COMM_API_AUTHENTICATION): Bearer auth for GitHub API rate limits.
    const token = deps.githubToken ?? process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  // Agentic Rule (ARNIE_API_NETWORK_REQUESTS): Hardcoded allowlisted URL, timeout, no user-controlled target.
  // Agentic Rule (ARNIE_SSRF_REQUEST_TIMEOUTS): Cap version-check latency so scans still proceed.
  // Agentic Rule (ARNIE_SSRF_REDIRECT_LIMITS): Reject redirects to unvalidated hosts.
  // Agentic Rule (ARNIE_COMM_HTTPS_USAGE): HTTPS-only version registry requests.
  // Agentic Rule (ARNIE_COMM_CLIENT_CONFIGURATION): Timeout + default TLS verification.
  const response = await fetchFn(url, {
    method: "GET",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(VERSION_CHECK_TIMEOUT_MS),
  });

  if (!response.ok) {
    return undefined;
  }

  try {
    // Agentic Rule (ARNIE_API_JSON_PARSING): Parse registry JSON in try/catch; ignore malformed bodies.
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

async function fetchLatestVersion(
  deps: VersionCheckDeps
): Promise<string | undefined> {
  const body = await fetchJson<{ version?: string }>(NPM_LATEST_URL, deps);
  const parsed = body?.version ? parseSemver(body.version) : undefined;
  if (!parsed) {
    return undefined;
  }
  return formatSemver(parsed);
}

async function fetchTagCommitSha(
  version: string,
  deps: VersionCheckDeps
): Promise<string | undefined> {
  const url = `${GITHUB_COMMIT_URL_PREFIX}v${version}`;
  const body = await fetchJson<{ sha?: string }>(url, deps);
  if (!body?.sha || !SHA_PATTERN.test(body.sha)) {
    return undefined;
  }
  return body.sha.toLowerCase();
}

function updateMessage(latest: string, current: string): string {
  return `Update available: ${PACKAGE_NAME}@${latest} (current: ${current})`;
}

export async function getUpdateLogMessage(
  deps: VersionCheckDeps = {}
): Promise<string | undefined> {
  try {
    const current = resolveCurrentVersion(deps);
    if (current.kind === "skip") {
      return undefined;
    }

    const latest = await fetchLatestVersion(deps);
    if (!latest) {
      return undefined;
    }

    if (current.kind === "semver") {
      if (!isNewerVersion(latest, current.version)) {
        return undefined;
      }
      return updateMessage(latest, current.version);
    }

    const latestSha = await fetchTagCommitSha(latest, deps);
    if (!latestSha || latestSha === current.sha) {
      return undefined;
    }
    return updateMessage(latest, current.sha.slice(0, 12));
  } catch {
    // Agentic Rule (ARNIE_HANDLING_EXCEPTION_HANDLING): Version check is best-effort; never fail the scan.
    return undefined;
  }
}
