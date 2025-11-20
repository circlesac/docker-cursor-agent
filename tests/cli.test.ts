import { execSync } from "child_process"
import { mkdir, readFile, rm, writeFile } from "fs/promises"
import { join } from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { generateMcpConfig } from "../src/utils.js"

describe("MCP Config Generator CLI", () => {
	const testDir = join(process.cwd(), ".test-tmp")
	const sampleMcpJson = {
		mcpServers: {
			"test-server": {
				command: "node",
				args: ["server.js"]
			},
			"another-server": {
				command: "python",
				args: ["-m", "server"]
			}
		}
	}

	beforeEach(async () => {
		await mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true })
	})

	it("should generate mcp.json and approvals files", async () => {
		const inputFile = join(testDir, "mcp.json")
		const outputDir = join(testDir, "output")

		await writeFile(inputFile, JSON.stringify(sampleMcpJson, null, 2), "utf8")

		await generateMcpConfig(inputFile, outputDir)

		// Check that mcp.json was copied
		const mcpJsonPath = join(outputDir, ".cursor", "mcp.json")
		const mcpJsonContent = await readFile(mcpJsonPath, "utf8")
		const mcpJson = JSON.parse(mcpJsonContent)
		expect(mcpJson).toEqual(sampleMcpJson)

		// Check that approvals file was created
		const approvalsPath = join(outputDir, ".cursor", "projects", "workspace", "mcp-approvals.json")
		const approvalsContent = await readFile(approvalsPath, "utf8")
		const approvals = JSON.parse(approvalsContent) as string[]

		expect(Array.isArray(approvals)).toBe(true)
		expect(approvals.length).toBe(2)
		expect(approvals[0]).toMatch(/^test-server-[a-f0-9]{16}$/)
		expect(approvals[1]).toMatch(/^another-server-[a-f0-9]{16}$/)
	})

	it("should generate consistent approval hashes", async () => {
		const inputFile = join(testDir, "mcp.json")
		const outputDir1 = join(testDir, "output1")
		const outputDir2 = join(testDir, "output2")

		await writeFile(inputFile, JSON.stringify(sampleMcpJson, null, 2), "utf8")

		// Generate twice with same config
		await generateMcpConfig(inputFile, outputDir1)
		await generateMcpConfig(inputFile, outputDir2)

		const approvals1Path = join(outputDir1, ".cursor", "projects", "workspace", "mcp-approvals.json")
		const approvals2Path = join(outputDir2, ".cursor", "projects", "workspace", "mcp-approvals.json")

		const approvals1 = JSON.parse(await readFile(approvals1Path, "utf8")) as string[]
		const approvals2 = JSON.parse(await readFile(approvals2Path, "utf8")) as string[]

		expect(approvals1).toEqual(approvals2)
	})

	it("should handle CLI execution", () => {
		// Test CLI help (help output goes to stderr, so we capture both stdout and stderr)
		const result = execSync("node dist/cli.js --help 2>&1", { encoding: "utf-8" })
		expect(result).toContain("Usage:")
		expect(result).toContain("--file")
		expect(result).toContain("--out")
	})

	it("should fail with invalid mcp.json", async () => {
		const inputFile = join(testDir, "invalid.json")
		const outputDir = join(testDir, "output")

		await writeFile(inputFile, "{ invalid json }", "utf8")

		await expect(generateMcpConfig(inputFile, outputDir)).rejects.toThrow("Failed to parse mcp.json")
	})

	it("should fail with missing mcpServers", async () => {
		const inputFile = join(testDir, "invalid.json")
		const outputDir = join(testDir, "output")

		await writeFile(inputFile, JSON.stringify({}), "utf8")

		await expect(generateMcpConfig(inputFile, outputDir)).rejects.toThrow("missing or invalid 'mcpServers' field")
	})
})
