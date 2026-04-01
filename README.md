<p align="center">
  <a href="https://app.arnica.io">
    <img src="docs/images/arnica-logo.png" alt="Arnica" height="120" />
  </a>
</p>

## Arnica Dependency Scan – GitHub Action

The same scanner is available as a **GitHub Action** (composite) and as an **npm CLI** for Azure DevOps and Bitbucket Pipelines (`npx @arnica-io/dependency-scan`).

Extend Arnica’s security scanning into complex build environments that pull dependencies from multiple sources or compile packages from source.
When real-time checks aren’t enough, post-build scanning validates SBOMs directly from your CI/CD pipelines via API, returning pass/fail results to enforce security gates before merges or deployments. Ensure consistent policy enforcement and centralized visibility in Arnica’s dashboard, even for environments with intricate dependency resolution.

### Quickstart

Add a workflow that runs on PR events and merges to SLA branches for complete security coverage.

```yaml
name: Arnica Dependency Security Scan
on:
  pull_request:
    types: [opened, synchronize]
  push:
    branches: [main, develop, staging, production] # Add your SLA branches
  workflow_dispatch:

jobs:
  security-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Checkout repository
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd #v6.0.2
        with:
          persist-credentials: false

      - name: Dependency Security Scan with Arnica
        id: arnica
        uses: arnica-io/dependency-scan@35465acb89aaaad9de1bd6be79cb8f011267978a # v1.0.30
        env:
          ARNICA_API_TOKEN: ${{ secrets.ARNICA_API_TOKEN }}
        with:
          repository-url: ${{ github.server_url }}/${{ github.repository }}
          branch: ${{ github.head_ref | github.ref_name }} # Uses the PR source branch for pull requests, or the current branch for pushes
          scan-path: .

      - name: Print scan results
        run: |
          echo "Scan ID: ${{ steps.arnica.outputs['scan-id'] }}"
          echo "Status: ${{ steps.arnica.outputs.status }}"
```

### Pinning to a Commit SHA

While Arnica's action tags are immutable, as a general best practice we recommend pinning all GitHub Actions to a full commit SHA rather than a tag. SHA pinning ensures your workflows are deterministic and aligned with [GitHub's security hardening guidelines](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions).

```yaml
# Best practice – pinned to commit SHA
uses: arnica-io/dependency-scan@35465acb89aaaad9de1bd6be79cb8f011267978a # v1.0.30
```

The SHA for each release is listed on the [Releases](../../releases) page. This README is automatically updated with the latest SHA on every release.

### Package Integrity

All npm packages are published with [SLSA provenance](https://docs.npmjs.com/generating-provenance-statements), providing cryptographic proof that each build originated from this repository. npm versions are immutable — once published, they cannot be modified or overwritten.

### Recommended Workflow Triggers

For complete security coverage and accurate issue lifecycle tracking:

- **Pull Requests**: `opened`, `synchronize` - Catches issues before merge
- **Main/Release Branches**: `push` to `main`, `develop`, `staging`, `production`
- **Build Pipelines**: Add to any workflow where code is built or deployed
- **Manual Runs**: `workflow_dispatch` for on-demand scans

### Where to View Reports

Security scan results appear in multiple locations:

1. **GitHub Step Summary**: Detailed findings report in the workflow run
2. **Arnica Dashboard**: Full vulnerability management at `https://app.arnica.io`
3. **Workflow Logs**: Console output with scan details
4. **PR Comments** (if configured): Summary posted to pull requests

### Inputs

| Name                   | Required | Default                     | Description                                                                |
| ---------------------- | :------: | --------------------------- | -------------------------------------------------------------------------- |
| `repository-url`       |   Yes    |                             | Repository URL associated with the scan                                    |
| `branch`               |   Yes    | `main`                      | Branch to associate with the scan                                          |
| `scan-path`            |   No     |  `.`                        | Directory path to scan and generate SBOM for (e.g., `.` or `services/api`) |
| `api-base-url`         |    No    | `https://api.app.arnica.io` | Arnica API base URL                                                        |
| `api-token`            |    No    |                             | Arnica API token; prefer secret env `ARNICA_API_TOKEN`                     |
| `scan-timeout-seconds` |    No    | `900`                       | Timeout (seconds) to wait for scan completion                              |
| `on-findings`          |    No    | `fail`                      | Behavior when findings are detected: fail, alert, or pass                  |

### Outputs

- **scan-id**: Arnica scan identifier.
- **status**: Final status, one of `Success`, `Failure`, `Error`, `Skipped`, or `Timeout`.

### Environment variables

- **ARNICA_API_TOKEN**: Alternative to the `api-token` input. Recommended to pass via `${{ secrets.ARNICA_API_TOKEN }}`.

### Permissions

This action does not require repository write permissions. For least privilege, set:

```yaml
permissions:
  contents: read
```

### Examples

Scan a subdirectory and alert (do not fail) on policy violations:

```yaml
- name: Generate SBOM and scan with Arnica
  id: arnica
  uses: arnica-io/dependency-scan@35465acb89aaaad9de1bd6be79cb8f011267978a # v1.0.30
  env:
    ARNICA_API_TOKEN: ${{ secrets.ARNICA_API_TOKEN }}
  with:
    repository-url: https://github.com/owner/repo
    branch: ${{ github.ref_name }}
    scan-path: services/payments
    on-findings: alert
```

### Prerequisites

- Sign in to Arnica with a privileged `admin` account. Sign in at `https://app.arnica.io`.

### API key and permissions

Create an Arnica API key with only the SBOM scopes:

1. Navigate to Admin → API.
2. Create a new API key.
3. Select scopes: `sbom-api:read` and `sbom-api:write` only.
4. Store the token as a repository secret named `ARNICA_API_TOKEN`.

---

## Azure DevOps Pipelines

Use the **published npm package** from the registry (`npx`). You only need `checkout: self` and a Node task—no extra GitHub service connection for the default flow.

### Prerequisites

1. **ARNICA_API_TOKEN**: Store in a **Variable Group** (e.g. `arnica-secrets` under **Pipelines → Library**) as a secret.
2. **Node.js 24+** on the agent (`NodeTool@0`).

### Example pipeline

```yaml
trigger:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

variables:
  - group: arnica-secrets

steps:
  - checkout: self

  - task: NodeTool@0
    inputs:
      versionSpec: "24.x"
    displayName: Use Node 24

  - script: |
      set -euo pipefail
      cd "$(Build.SourcesDirectory)"
      npx --yes "@arnica-io/dependency-scan@1.0.30"
    displayName: Arnica dependency scan
    env:
      ARNICA_API_TOKEN: $(ARNICA_API_TOKEN)
      INPUT_REPOSITORY_URL: $(Build.Repository.Uri)
      INPUT_BRANCH: $(Build.SourceBranchName)
      INPUT_SCAN_PATH: "."
      INPUT_ON_FINDINGS: fail
```

Pin the version in the `npx` argument (`@x.y.z`). This README is updated with current pins on each release.

### Self-hosted agent note (`npm.pkg.github.com` / 401)

If your Azure DevOps self-hosted agent has a global/user `.npmrc` that maps `@arnica-io` to GitHub Packages, `npx` may fail with `401 Unauthorized` against `npm.pkg.github.com`.

Force npmjs for this step:

```yaml
  - script: |
      set -euo pipefail
      cd "$(Build.SourcesDirectory)"
      npm config set registry "https://registry.npmjs.org/"
      npm config delete @arnica-io:registry || true
      npx --registry "https://registry.npmjs.org/" --yes "@arnica-io/dependency-scan@1.0.28"
    displayName: Arnica dependency scan
```

### Advanced: build from a git checkout (lockfile-pinned)

If you want transitives fixed to this repo’s `pnpm-lock.yaml`, add a **GitHub service connection**, check out `arnica-io/dependency-scan` at a release tag, then `corepack prepare pnpm@9.15.4 --activate`, `pnpm install --frozen-lockfile`, `pnpm run build`, and run `node dist/cli.js` with `PATH` including that checkout’s `node_modules/.bin`. Use the same `INPUT_*` / `ARNICA_API_TOKEN` env as above from `$(Build.SourcesDirectory)` for the project you are scanning (`checkout: self`).

### Environment variables

| Name                         | Required | Default                     | Description                                                  |
| ---------------------------- | :------: | --------------------------- | ------------------------------------------------------------ |
| `ARNICA_API_TOKEN`           |   Yes    |                             | Arnica API token                                             |
| `INPUT_REPOSITORY_URL`       |   No*    |                             | Repository URL override (auto-detected from CI when omitted) |
| `INPUT_BRANCH`               |   No*    |                             | Branch override (auto-detected from CI when omitted)         |
| `INPUT_SCAN_PATH`            |   No     | `.`                         | Directory path to scan                                       |
| `INPUT_API_BASE_URL`         |   No     | `https://api.app.arnica.io` | Arnica API base URL                                          |
| `INPUT_SCAN_TIMEOUT_SECONDS` |   No     | `900`                       | Timeout (seconds) for scan completion                        |
| `INPUT_ON_FINDINGS`          |   No     | `fail`                      | `fail`, `alert`, or `pass`                                   |
| `INPUT_DEBUG`                |   No     | `false`                     | Verbose API debug logs                                       |

\*In Azure DevOps these are auto-detected from `BUILD_REPOSITORY_URI` / `BUILD_SOURCEBRANCHNAME`. Set only if you need overrides.

### Example: scan a subdirectory, alert only

Add to the same `env` block as the main example:

```yaml
      INPUT_SCAN_PATH: "services/payments"
      INPUT_ON_FINDINGS: alert
```

### Where to View Reports (Azure DevOps)

1. **Pipeline Extensions Tab**: Scan summary is uploaded as a task summary attachment
2. **Arnica Dashboard**: Full vulnerability management at `https://app.arnica.io`
3. **Pipeline Logs**: Console output with scan details

---

## Bitbucket Pipelines

Use the **published npm package** with `npx`, same as Azure DevOps.

- **Bitbucket Cloud**: auto-detects from `BITBUCKET_GIT_HTTP_ORIGIN` and `BITBUCKET_BRANCH`.
- **Bitbucket Server/Data Center runners**: also supports `BITBUCKET_GIT_SSH_ORIGIN` and derives a repository URL from `BITBUCKET_SERVER_URL` + `BITBUCKET_REPO_FULL_NAME` when needed.

You can always override detection with `INPUT_REPOSITORY_URL` and `INPUT_BRANCH`.

### Prerequisites

1. **ARNICA_API_TOKEN**: Store as a **secured** repository variable (Repository settings → Pipelines → Repository variables).
2. **Node.js 24+** on the step image (for example `node:24`).

### Example pipeline

```yaml
image: node:24

pipelines:
  default:
    - step:
        name: Arnica dependency scan
        script:
          - cd "$BITBUCKET_CLONE_DIR"
          - npx --yes "@arnica-io/dependency-scan@1.0.30"
        artifacts:
          - arnica-scan-summary.md
          - .arnica-scan-outputs.env
        variables:
          ARNICA_API_TOKEN: $ARNICA_API_TOKEN
```

Pin the version in the `npx` argument (`@x.y.z`). This README is updated with current pins on each release.

### Advanced: test scanner from source before npm publish

If you want to validate unreleased changes, clone the scanner source in the pipeline, build it, and run `node dist/cli.js` instead of `npx`.

```yaml
image: node:24

pipelines:
  default:
    - step:
        name: Arnica dependency scan (from source)
        script:
          - set -euo pipefail
          - export TARGET_REPO_DIR="$BITBUCKET_CLONE_DIR"
          - export SCAN_SRC_DIR="/tmp/dependency-scan-src"
          - git clone --depth 1 --branch "${ARNICA_SCAN_REF:-main}" "${ARNICA_SCAN_REPO_URL}" "$SCAN_SRC_DIR"
          - cd "$SCAN_SRC_DIR"
          - corepack enable
          - corepack prepare pnpm@9.15.4 --activate
          - pnpm install --frozen-lockfile
          - pnpm run build
          - export PATH="$SCAN_SRC_DIR/node_modules/.bin:$PATH"
          - export BITBUCKET_CLONE_DIR="$TARGET_REPO_DIR"
          - export ARNICA_API_TOKEN="$ARNICA_API_TOKEN"
          - export INPUT_REPOSITORY_URL="${INPUT_REPOSITORY_URL:-${BITBUCKET_GIT_HTTP_ORIGIN:-}}"
          - export INPUT_BRANCH="${INPUT_BRANCH:-${BITBUCKET_BRANCH:-main}}"
          - export INPUT_SCAN_PATH="${INPUT_SCAN_PATH:-.}"
          - node dist/cli.js
        artifacts:
          - arnica-scan-summary.md
          - .arnica-scan-outputs.env
        variables:
          ARNICA_API_TOKEN: $ARNICA_API_TOKEN
          ARNICA_SCAN_REPO_URL: $ARNICA_SCAN_REPO_URL
          ARNICA_SCAN_REF: $ARNICA_SCAN_REF
```

Required variables for this mode:

- `ARNICA_API_TOKEN` (secured)
- `ARNICA_SCAN_REPO_URL` (git URL to your private/public dependency-scan fork)
- `ARNICA_SCAN_REF` (optional branch/tag/commit; defaults to `main`)

### Outputs and summary

Bitbucket Pipelines does not expose GitHub-style step outputs or Azure `##vso` variables. This integration:

- Logs lines `ARNICA_OUTPUT <name>=<value>` for visibility in the build log.
- Appends `name=value` lines to **`.arnica-scan-outputs.env`** under the clone directory (optional `source` in a later step, or keep via artifacts).
- Writes **`arnica-scan-summary.md`** in the clone directory; list both files under `artifacts` if you want to download them.

### Environment variables

| Name                         | Required | Default                     | Description                                                                 |
| ---------------------------- | :------: | --------------------------- | --------------------------------------------------------------------------- |
| `ARNICA_API_TOKEN`           |   Yes    |                             | Arnica API token                                                            |
| `INPUT_REPOSITORY_URL`       |   No*    |                             | Repository URL override                                                     |
| `INPUT_BRANCH`               |   No*    |                             | Branch override                                                             |
| `INPUT_SCAN_PATH`            |   No     | `.`                         | Directory path to scan                                                      |
| `INPUT_API_BASE_URL`         |   No     | `https://api.app.arnica.io` | Arnica API base URL                                                         |
| `INPUT_SCAN_TIMEOUT_SECONDS` |   No     | `900`                       | Timeout (seconds) for scan completion                                       |
| `INPUT_ON_FINDINGS`          |   No     | `fail`                      | `fail`, `alert`, or `pass`                                                  |
| `INPUT_DEBUG`                |   No     | `false`                     | Verbose API debug logs                                                      |

\*On Bitbucket Pipelines, `INPUT_REPOSITORY_URL` / `INPUT_BRANCH` are auto-detected when unset.

Repository URL detection fallback order:

1. `BITBUCKET_GIT_HTTP_ORIGIN`
2. `BITBUCKET_GIT_SSH_ORIGIN`
3. `BITBUCKET_SERVER_URL` (or `BITBUCKET_BASE_URL`) + `BITBUCKET_REPO_FULL_NAME`
4. `https://bitbucket.org/<BITBUCKET_REPO_FULL_NAME>`

Branch detection fallback order:

1. `BITBUCKET_BRANCH`
2. `BITBUCKET_PR_SOURCE_BRANCH`
3. `BITBUCKET_SOURCE_BRANCH`
4. `BITBUCKET_BRANCH_NAME`

### Example: scan a subdirectory, alert only

Add to the same `script` or export env before `npx`:

```yaml
        script:
          - export INPUT_SCAN_PATH="services/payments"
          - export INPUT_ON_FINDINGS="alert"
          - cd "$BITBUCKET_CLONE_DIR"
          - npx --yes "@arnica-io/dependency-scan@1.0.30"
```

### Where to View Reports (Bitbucket)

1. **Build logs**: `ARNICA_OUTPUT` lines and scan progress
2. **Artifacts**: `arnica-scan-summary.md` if declared under `artifacts`
3. **Arnica Dashboard**: Full vulnerability management at `https://app.arnica.io`

### Troubleshooting (Bitbucket)

- **Repository URL is missing**
  - Set `INPUT_REPOSITORY_URL` explicitly in the step environment.
  - Verify your runner exports one of: `BITBUCKET_GIT_HTTP_ORIGIN`, `BITBUCKET_GIT_SSH_ORIGIN`, or (`BITBUCKET_SERVER_URL` + `BITBUCKET_REPO_FULL_NAME`).
- **Unexpected branch value in PR pipelines**
  - PR pipelines may expose multiple branch variables depending on runner type.
  - Set `INPUT_BRANCH` explicitly if you need strict source-branch mapping.
- **No summary/output artifacts visible**
  - Make sure `arnica-scan-summary.md` and `.arnica-scan-outputs.env` are listed under `artifacts`.

---

### Contributing

See `CONTRIBUTING.md` for development, testing, and release guidance. Please open an Issue first for substantial changes.

### Code of Conduct

This project adheres to a Code of Conduct. By participating, you agree to uphold it. See `CODE_OF_CONDUCT.md`.

### License

MIT — see `LICENSE.md`.

### Support

Questions or issues? Open a GitHub Issue. You can also propose enhancements via a feature request Issue or PR.
