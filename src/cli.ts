#!/usr/bin/env node

import { generateMcpConfig } from "./utils.js"

function printUsage(): void {
	console.error(`
Usage: docker-cursor-agent --file <mcp.json> --out <output-dir>

Options:
  --file, -f    Path to input mcp.json file (required)
  --out, -o     Output directory where .cursor folder will be created (required, defaults to current directory)

Examples:
  docker-cursor-agent --file ./mcp.json --out ./build
  docker-cursor-agent -f ./mcp.json -o ./build
`)
}

function parseArgs(): { file?: string; out?: string } {
	const args = process.argv.slice(2)
	const result: { file?: string; out?: string } = {}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === "--file" || arg === "-f") {
			if (i + 1 >= args.length) {
				console.error("Error: --file requires a value")
				process.exit(1)
			}
			result.file = args[++i]
		} else if (arg === "--out" || arg === "-o") {
			if (i + 1 >= args.length) {
				console.error("Error: --out requires a value")
				process.exit(1)
			}
			result.out = args[++i]
		} else if (arg === "--help" || arg === "-h") {
			printUsage()
			process.exit(0)
		} else {
			console.error(`Error: Unknown option: ${arg}`)
			printUsage()
			process.exit(1)
		}
	}

	return result
}

async function main(): Promise<void> {
	const { file, out } = parseArgs()

	if (!file) {
		console.error("Error: --file is required")
		printUsage()
		process.exit(1)
	}

	const outputDir = out || process.cwd()

	try {
		await generateMcpConfig(file, outputDir)

		console.info(`✓ Generated MCP configuration files:`)
		console.info(`  ${outputDir}/.cursor/mcp.json`)
		console.info(`  ${outputDir}/.cursor/projects/workspace/mcp-approvals.json`)
		console.info(``)
		console.info(`To use with Docker:`)
		console.info(`  docker run --rm \\`)
		console.info(`    -e CURSOR_API_KEY=your_key \\`)
		console.info(`    -v $(pwd)/${outputDir}/.cursor:/root/.cursor \\`)
		console.info(`    ghcr.io/circlesac/docker-cursor-agent:latest \\`)
		console.info(`    --print --output-format stream-json "your prompt"`)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		console.error(`Error: ${errorMessage}`)
		process.exit(1)
	}
}

main().catch((error) => {
	const errorMessage = error instanceof Error ? error.message : String(error)
	console.error(`Fatal error: ${errorMessage}`)
	process.exit(1)
})
