# Docker Cursor Agent

A Docker wrapper for Cursor CLI that allows you to run `cursor-agent` commands inside a container.

## Overview

This project provides a Docker container that wraps the Cursor CLI, allowing you to execute `cursor-agent` commands as if it were a native binary. The container acts as a transparent wrapper, passing all arguments through to the `cursor-agent` binary.

## Prerequisites

- Docker installed and running
- Bun runtime (for development)
- `gh` CLI installed and authenticated (required for local deployment)
- `CURSOR_API_KEY` environment variable set (required for testing)

## Installation

### Build the Docker Image

```bash
# Using npm script
bun run build

# Or directly with Docker
docker build -t docker-cursor-agent .
```

The image is based on `debian:stable-slim` and optimized for size (~291MB).

### Pull from GHCR

```bash
docker pull ghcr.io/circlesac/docker-cursor-agent:latest
```

## Usage

### Basic Usage

Run `cursor-agent` commands through Docker:

```bash
# Using the published image from GHCR
docker run --rm -e CURSOR_API_KEY=your_key ghcr.io/circlesac/docker-cursor-agent:latest --version
docker run --rm -e CURSOR_API_KEY=your_key ghcr.io/circlesac/docker-cursor-agent:latest --help

# Or using locally built image
docker run --rm -e CURSOR_API_KEY=your_key docker-cursor-agent --version
```

### Passing Arguments

All arguments are passed through to `cursor-agent`:

```bash
# Using published image
docker run --rm -e CURSOR_API_KEY=your_key ghcr.io/circlesac/docker-cursor-agent:latest <your-args>

# Or using locally built image
docker run --rm -e CURSOR_API_KEY=your_key docker-cursor-agent <your-args>
```

### Environment Variables

- `CURSOR_API_KEY` - Required for cursor-agent to function (pass via `-e` flag)

## Development

### Setup

```bash
bun install
```

### Build

```bash
bun run build
```

Builds the Docker image locally.

### Run Tests

```bash
bun run test
```

**Note:** Tests require `CURSOR_API_KEY` to be set in your environment. Tests will fail if it's not present.

### Lint

```bash
bun run lint
```

### Deploy to GHCR

Deploy the Docker image to GitHub Container Registry:

```bash
# Deploy using TypeScript script (recommended for production)
bun run deploy

# Or test deployment locally using act (requires act installed)
bun run deploy:act
```

The deploy script will:

1. Get authentication token (from `GITHUB_TOKEN`, `GHCR_TOKEN`, or `gh` CLI)
2. Extract repository info from git remote
3. Build Docker image
4. Push to `ghcr.io/circlesac/docker-cursor-agent:latest`

**Published Image**: The image is available at `ghcr.io/circlesac/docker-cursor-agent:latest`

**Note**: `deploy:act` uses [act](https://github.com/nektos/act) to test the GitHub Actions workflow locally. It passes `GITHUB_TOKEN` directly to [act](https://github.com/nektos/act) using `gh auth token`.

#### Environment Variables for Deploy

- `GITHUB_TOKEN` - Auto-provided in GitHub Actions (has GHCR permissions)
- `GHCR_TOKEN` - Optional override for local deployment
- `GHCR_TAG` - Optional image tag (defaults to `latest`)
- `GITHUB_ACTOR` - Optional username for login (defaults to repo owner)

#### Local Deployment

For local deployment, ensure you have `gh` CLI authenticated:

```bash
gh auth login --scopes write:packages
```

Or set `GHCR_TOKEN` environment variable:

```bash
export GHCR_TOKEN=your_token
bun run deploy
```

## Project Structure

```
docker-cursor-agent/
├── .dockerignore         # Docker ignore patterns
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions workflow for automated deployment
├── .gitignore           # Git ignore patterns
├── Dockerfile            # Debian-based container definition
├── package.json          # Bun project configuration
├── README.md             # This file
├── scripts/
│   └── deploy.ts         # Deployment script to GHCR
├── tests/
│   └── docker.test.ts    # Vitest tests
├── tsconfig.json        # TypeScript configuration
└── vitest.config.ts     # Vitest configuration
```
