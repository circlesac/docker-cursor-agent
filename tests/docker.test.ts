import Ajv from "ajv"
import { execSync } from "child_process"
import { beforeAll, describe, expect, it } from "vitest"

const IMAGE_NAME = "docker-cursor-agent-test"
const CURSOR_API_KEY = process.env.CURSOR_API_KEY

describe("Docker Cursor Agent", () => {
	beforeAll(() => {
		// Fail immediately if CURSOR_API_KEY is not set
		if (!CURSOR_API_KEY) {
			throw new Error("CURSOR_API_KEY environment variable is required for tests. Please set it before running tests.")
		}
	})

	it("should build Docker image successfully", () => {
		expect(() => {
			execSync(`docker build -t ${IMAGE_NAME} .`, {
				stdio: "pipe"
			})
		}).not.toThrow()
	})

	it("should have cursor-agent installed and accessible", () => {
		const output = execSync(`docker run --rm ${IMAGE_NAME} --version`, {
			encoding: "utf-8",
			stdio: "pipe"
		})
		expect(output).toBeTruthy()
		expect(output.trim().length).toBeGreaterThan(0)
	})

	it("should pass CURSOR_API_KEY to container", () => {
		const output = execSync(`docker run --rm -e CURSOR_API_KEY=${CURSOR_API_KEY} ${IMAGE_NAME} --version`, {
			encoding: "utf-8",
			stdio: "pipe"
		})
		expect(output).toBeTruthy()
	})

	it("should pass arguments through to cursor-agent", () => {
		const output = execSync(`docker run --rm ${IMAGE_NAME} --help`, {
			encoding: "utf-8",
			stdio: "pipe"
		})
		expect(output).toBeTruthy()
		expect(output.toLowerCase()).toContain("help")
	})

	it("should handle version command", () => {
		const output = execSync(`docker run --rm ${IMAGE_NAME} --version`, {
			encoding: "utf-8",
			stdio: "pipe"
		})
		expect(output).toBeTruthy()
	})

	it("should send prompt and receive JSON response matching schema", () => {
		const jsonSchema = {
			type: "object",
			properties: {
				answer: { type: "string" },
				confidence: { type: "number", minimum: 0, maximum: 1 }
			},
			required: ["answer", "confidence"],
			additionalProperties: false
		}

		const prompt = `Respond with a JSON object containing an "answer" (string) and "confidence" (number 0-1) for: What is 2+2?`

		const command = `docker run --rm -e CURSOR_API_KEY=${CURSOR_API_KEY} ${IMAGE_NAME} --print --output-format stream-json "${prompt}" 2>/dev/null`

		let output: string
		try {
			output = execSync(command, {
				encoding: "utf-8",
				stdio: "pipe",
				timeout: 60000 // 60 second timeout for API call
			})
		} catch (error) {
			// If command fails or times out, fail the test
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new Error(`Failed to execute cursor-agent command: ${errorMessage}`)
		}

		// Debug: print the raw output
		console.info("Raw output:", output)

		// Parse JSON response (stream-json may return multiple JSON objects)
		let response: unknown
		try {
			// stream-json returns newline-delimited JSON objects
			// Split by newlines and parse each JSON object
			const lines = output
				.trim()
				.split("\n")
				.filter((line) => line.trim().length > 0)
			const jsonObjects: unknown[] = []

			for (const line of lines) {
				try {
					const parsed = JSON.parse(line.trim())
					jsonObjects.push(parsed)
				} catch {
				}
			}

			if (jsonObjects.length === 0) {
				throw new Error("No valid JSON objects found in output")
			}

			// Find the final result object (usually the last one with a "result" field)
			// or use the last object if no result field is found
			let finalObject: unknown = jsonObjects[jsonObjects.length - 1]

			// Look for an object with a "result" field (the actual response)
			for (let i = jsonObjects.length - 1; i >= 0; i--) {
				const obj = jsonObjects[i]
				if (typeof obj === "object" && obj !== null && "result" in obj) {
					finalObject = obj
					break
				}
			}

			// Extract the actual response from the wrapper
			if (typeof finalObject === "object" && finalObject !== null && "result" in finalObject) {
				let resultContent = (finalObject as { result: string }).result

				// Extract JSON from markdown code blocks if present
				const codeBlockMatch = resultContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
				if (codeBlockMatch) {
					resultContent = codeBlockMatch[1]
				}

				// Try to parse the result as JSON
				response = JSON.parse(resultContent.trim())
			} else {
				// If no wrapper, use the parsed JSON directly
				response = finalObject
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new Error(`Failed to parse JSON response: ${errorMessage}. Output: ${output}`)
		}

		// Debug: print the parsed response
		console.info("Parsed response:", JSON.stringify(response, null, 2))

		// Validate against schema
		const ajv = new Ajv()
		const validate = ajv.compile(jsonSchema)
		const valid = validate(response)

		if (!valid) {
			throw new Error(`Response does not match schema: ${JSON.stringify(validate.errors)}. Response: ${JSON.stringify(response)}`)
		}

		expect(response).toHaveProperty("answer")
		expect(response).toHaveProperty("confidence")
		expect(typeof (response as { answer: string; confidence: number }).answer).toBe("string")
		expect(typeof (response as { answer: string; confidence: number }).confidence).toBe("number")
		expect((response as { answer: string; confidence: number }).confidence).toBeGreaterThanOrEqual(0)
		expect((response as { answer: string; confidence: number }).confidence).toBeLessThanOrEqual(1)
	})
})
