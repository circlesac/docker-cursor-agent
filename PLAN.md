# Docker Cursor Agent - Implementation Plan

## Overview

Create a Docker wrapper for Cursor CLI that acts as a containerized `cursor-agent` binary, following Circles' development workflow with Bun and Vitest.

## Project Structure

```
docker-cursor-agent/
├── .dockerignore         # Docker ignore patterns
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions workflow for automated deployment
├── .gitignore            # Git ignore patterns
├── Dockerfile            # Debian-based container
├── package.json          # Bun project config with scripts
├── README.md             # Usage docs with GHCR instructions
├── scripts/
│   └── deploy.ts         # Deploy script (TypeScript)
├── tests/
│   └── docker.test.ts    # Vitest tests
├── tsconfig.json         # TypeScript config
├── vitest.config.ts      # Vitest configuration
├── bun.lock              # Bun lockfile
└── PLAN.md               # This file
```

## Implementation Details

### 1. Dockerfile (Debian-based)

- Base: `debian:stable-slim` (tracks current stable Debian release)
- Install: `curl`, `ca-certificates` (via `apt-get`)
- Install Cursor CLI: `curl https://cursor.com/install -fsS | bash`
- Add `~/.local/bin` to PATH in container (`/root/.local/bin`)
- `ENTRYPOINT ["cursor-agent"]` to pass args through
- Accept `CURSOR_API_KEY` as environment variable
- Clean up apt cache and temp files to minimize size
- **Note**: Changed from Alpine to Debian because cursor-agent binary requires glibc and C++ standard library (not available in Alpine's musl)

### 2. Package.json Scripts

- `build` - Build Docker image (`docker build -t docker-cursor-agent .`)
- `test` - Run Vitest tests (`vitest run`)
- `lint` - Run linting (`npx @circlesac/lint --all`)
- `deploy` - Run `bun scripts/deploy.ts` (production deployment)
- `deploy:act` - Test deployment locally using [act](https://github.com/nektos/act) (runs GitHub Actions workflow)

### 3. Deploy Script (`scripts/deploy.ts`)

- Token detection (in order):
  1. If `GITHUB_TOKEN` exists (GitHub Actions) → use it
  2. If `GHCR_TOKEN` exists → use it
  3. Otherwise → use `gh auth token` (scopes set during `gh auth login`)
- Extract repo info from git:
  - Owner: from `git remote get-url origin` (parse GitHub URL)
  - Repo name: from git remote or directory name
  - Tag: default to `latest` (can be overridden with `GHCR_TAG`)
- Build image: `docker build -t ghcr.io/owner/repo:tag .`
- Login: `docker login ghcr.io -u USERNAME -p TOKEN`
- Push: `docker push ghcr.io/owner/repo:tag`
- Use `Bun.spawn()` for shell commands
- Handle errors gracefully

### 4. Testing with Vitest

- Test file: `tests/docker.test.ts`
- Tests:
  - **Fail if `CURSOR_API_KEY` is missing** (first check)
  - Build Docker image successfully
  - Verify `cursor-agent` is installed (`--version` command)
  - Test `CURSOR_API_KEY` is passed to container correctly
  - Test argument passthrough (e.g., `--help`, `--version`)
  - **Send prompt and validate JSON schema response** - Tests actual API interaction with `--print --output-format stream-json`, validates response against JSON schema using `ajv`
- Use `bun run test` (Vitest runtime, not Bun test)

### 5. Environment Variables

- `CURSOR_API_KEY` - Required for tests (fail if missing)
- `GITHUB_TOKEN` - Auto-provided in GitHub Actions (has GHCR permissions)
- `GHCR_TOKEN` - Optional override for local deployment
- `GHCR_TAG` - Optional image tag for deploy (defaults to `latest`)
- `GITHUB_ACTOR` - Optional username for GHCR login (defaults to repo owner)

### 6. Dependencies

- `vitest` - Test framework
- `@types/node` - TypeScript types for Node.js
- `@types/bun` - TypeScript types for Bun runtime
- `typescript` - TypeScript compiler
- `ajv` - JSON schema validation library (for testing JSON schema responses)
- No additional deps for deploy script (use `Bun.spawn()`)

### 7. GitHub Container Registry

- Image format: `ghcr.io/OWNER/REPO-NAME:latest` (default tag)
- Owner and repo derived from git remote
- Authentication:
  - GitHub Actions: `GITHUB_TOKEN` (auto-provided)
  - Local: `gh auth token` (requires `gh auth login --scopes write:packages` first) or `GHCR_TOKEN` override

### 8. Testing Requirements

- Tests require `CURSOR_API_KEY` in environment
- If missing, tests fail immediately with clear error
- Tests verify Docker build, installation, and functionality

### 9. GitHub Actions Workflow

- Workflow file: `.github/workflows/deploy.yml`
- Triggers:
  - Daily schedule at UTC 0:00 (cron: `'0 0 * * *'`)
  - Manual trigger via `workflow_dispatch`
- Actions:
  - Checks out code
  - Sets up Docker Buildx
  - Logs in to GHCR using `GITHUB_TOKEN`
  - Builds and pushes Docker image with proper tags
  - Uses GitHub Actions cache for faster builds

### 10. Local Testing with Act

- Command: `bun run deploy:act` - Tests GitHub Actions workflow locally using [act](https://github.com/nektos/act)
- Passes `GITHUB_TOKEN` directly to [act](https://github.com/nektos/act) using `gh auth token` via `-s` flag
