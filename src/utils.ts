import { createHash } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import { join } from "path"

export interface McpServerConfig {
	args?: string[]
	[key: string]: unknown
}

export interface McpConfig {
	mcpServers: Record<string, McpServerConfig>
}

/**
 * Generate approval hashes for each MCP server in the config.
 * Approval hash format: `<server-name>-<hash>`
 * Hash is computed from: `{ path: "/workspace", server: config }`
 * SHA256 hash, first 16 characters
 */
export async function generateMcpApprovals(config: McpConfig, outputDir: string): Promise<void> {
	const projectDir = join(outputDir, ".cursor", "projects", "workspace")
	await mkdir(projectDir, { recursive: true })

	const approvalsPath = join(projectDir, "mcp-approvals.json")

	const approvals: string[] = []
	for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
		// Use /workspace as the path for approval key computation to match Docker container's perspective
		// cursor-agent in Docker runs from /workspace (work dir), so it computes project identifier based on that
		const hashInput = {
			path: "/workspace",
			server: serverConfig
		}
		const hash = createHash("sha256").update(JSON.stringify(hashInput)).digest("hex").slice(0, 16)
		approvals.push(`${name}-${hash}`)
	}

	await writeFile(approvalsPath, `${JSON.stringify(approvals, null, 2)}\n`, "utf8")
}

/**
 * Generate MCP config files from an input mcp.json file.
 * Creates:
 * - <outputDir>/.cursor/mcp.json - Copy of input mcp.json
 * - <outputDir>/.cursor/projects/workspace/mcp-approvals.json - MCP server approvals
 */
export async function generateMcpConfig(inputFile: string, outputDir: string): Promise<void> {
	// Read and parse input file
	const fileContents = await readFile(inputFile, "utf8")
	let config: McpConfig
	try {
		config = JSON.parse(fileContents) as McpConfig
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		throw new Error(`Failed to parse mcp.json: ${errorMessage}`)
	}

	// Validate config structure
	if (!config.mcpServers || typeof config.mcpServers !== "object") {
		throw new Error("Invalid mcp.json: missing or invalid 'mcpServers' field")
	}

	// Create output directory structure
	const cursorDir = join(outputDir, ".cursor")
	await mkdir(cursorDir, { recursive: true })

	// Copy mcp.json as-is to output directory
	const outputMcpPath = join(cursorDir, "mcp.json")
	await writeFile(outputMcpPath, fileContents, "utf8")

	// Generate approvals
	await generateMcpApprovals(config, outputDir)
}
