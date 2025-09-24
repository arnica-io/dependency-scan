## Contributing

Thanks for your interest in contributing! This repository hosts a GitHub Action (composite action). Below is how to develop, test, and release changes.

### Development workflow

- Fork and create a feature branch from the latest `main`.
- Make focused changes with clear commit messages (Conventional Commits encouraged).
- Keep edits minimal and avoid breaking changes unless necessary.

### Testing locally (via a workflow)

- Use the example workflow under `.github/workflows/arnica-sbom-upload-dev.yml` (or create a local workflow) to exercise the action.
- For external API calls, use staging credentials and repositories. Never commit secrets.

### Linting and checks

- CI runs action/workflow linting on push and PR via `.github/workflows/validate.yml`.
- Prefer adding tests or example workflows demonstrating new features when practical.

### Security

- Do not echo secrets or tokens. Avoid adding commands that could print sensitive data.
- Pin external actions to tags or SHAs in workflows.

### Opening a Pull Request

- Ensure the PR template checklist is completed.
- Link any related Issues and describe user impact and migration notes if applicable.
- Keep PRs small and easy to review.

### Releasing

- Maintain semantic versions: `vMAJOR.MINOR.PATCH` (e.g., `v1.2.3`).
- Create and push a tag (or draft a GitHub Release). The `release` workflow will:
  - Validate
  - Publish a GitHub Release with generated notes
  - Update the major tag (e.g., `v1`) to the latest release
- After releasing a new major, consider deprecating older majors in the README.

### Code of Conduct

By participating, you agree to abide by the `CODE_OF_CONDUCT.md`.


