#!/usr/bin/env bun

/**
 * Deploy script for pushing Docker image to GitHub Container Registry (GHCR)
 *
 * Token detection order:
 * 1. GITHUB_TOKEN (auto-provided in GitHub Actions)
 * 2. GHCR_TOKEN (optional override for local)
 * 3. gh auth token --scopes write:packages (fallback)
 */

async function getToken(): Promise<string> {
	// Check for GITHUB_TOKEN (GitHub Actions)
	if (process.env.GITHUB_TOKEN) {
		return process.env.GITHUB_TOKEN
	}

	// Check for GHCR_TOKEN override
	if (process.env.GHCR_TOKEN) {
		return process.env.GHCR_TOKEN
	}

	// Fallback to gh CLI
	try {
		const proc = Bun.spawn(["gh", "auth", "token"], {
			stdout: "pipe"
		})
		const token = await new Response(proc.stdout).text()
		return token.trim()
	} catch {
		throw new Error("Failed to get GitHub token. Please set GHCR_TOKEN or run: gh auth login --scopes write:packages")
	}
}

async function getRepoInfo(): Promise<{ owner: string; repo: string }> {
	try {
		// Get git remote URL
		const proc = Bun.spawn(["git", "remote", "get-url", "origin"], {
			stdout: "pipe"
		})
		const remoteUrl = (await new Response(proc.stdout).text()).trim()

		// Parse GitHub URL (handles both https and ssh formats)
		// https://github.com/owner/repo.git
		// git@github.com:owner/repo.git
		const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
		if (!match) {
			throw new Error(`Could not parse GitHub URL: ${remoteUrl}`)
		}

		const [, owner, repo] = match
		return { owner, repo }
	} catch {
		throw new Error("Failed to get repo info from git. Make sure you are in a git repository.")
	}
}

async function main() {
	try {
		console.info("🚀 Starting deployment to GHCR...")

		// Get token
		console.info("🔑 Getting authentication token...")
		const token = await getToken()
		const username = process.env.GITHUB_ACTOR || (await getRepoInfo()).owner

		// Get repo info
		console.info("📦 Getting repository information...")
		const { owner, repo } = await getRepoInfo()
		const tag = process.env.GHCR_TAG || "latest"
		const imageName = `ghcr.io/${owner}/${repo}:${tag}`

		console.info(`📝 Image: ${imageName}`)

		// Build Docker image
		console.info("🔨 Building Docker image...")
		const buildProcess = Bun.spawn(["docker", "build", "-t", imageName, "."], {
			stdout: "inherit",
			stderr: "inherit"
		})
		const buildExitCode = await buildProcess.exited
		if (buildExitCode !== 0) {
			throw new Error("Docker build failed")
		}

		// Login to GHCR
		console.info("🔐 Logging in to GHCR...")
		const loginProcess = Bun.spawn(["docker", "login", "ghcr.io", "-u", username, "--password-stdin"], {
			stdin: "pipe",
			stdout: "inherit",
			stderr: "inherit"
		})
		loginProcess.stdin.write(token + "\n")
		loginProcess.stdin.end()
		const loginExitCode = await loginProcess.exited
		if (loginExitCode !== 0) {
			throw new Error("Docker login failed")
		}

		// Push image
		console.info("📤 Pushing image to GHCR...")
		const pushProcess = Bun.spawn(["docker", "push", imageName], {
			stdout: "inherit",
			stderr: "inherit"
		})
		const pushExitCode = await pushProcess.exited
		if (pushExitCode !== 0) {
			throw new Error("Docker push failed")
		}

		console.info(`✅ Successfully deployed ${imageName}`)
	} catch (error) {
		console.error("❌ Deployment failed:", error instanceof Error ? error.message : error)
		process.exit(1)
	}
}

main()
