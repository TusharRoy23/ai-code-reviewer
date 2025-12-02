import { z } from "zod";
import { Agents, Priority } from "../utils/types.ts";
import { createAgent, initChatModel } from "langchain";
import { getLLMConfig } from "../utils/llm-config.ts";

const coordinatorSchema = z.object({
    agents: z.enum(Agents),
    priority: z.enum(Priority).default(Priority.LOW),
    reasoning: z.string()
});

const prompt = `You are a coordinator agent that analyzes code changes and determines which review agents are needed.

**Available Agents:**
- security: SQL injection, XSS, auth issues, crypto, secrets
- performance: O(n²) loops, N+1 queries, memory leaks, blocking I/O
- bugs: Logic errors, null checks, error handling, edge cases
- idiomatic: Language/framework best practices, modern patterns
- testing: Missing tests, untested edge cases, test quality
- architecture: SOLID violations, coupling, separation of concerns
- readability: Complex logic, naming, magic numbers, deep nesting

**Rules:**
1. ALWAYS include: security (unless it's a test file or config)
2. Include performance if: loops, database queries, async operations, large data
3. Include bugs if: conditional logic, error handling, new functions
4. Include idiomatic if: new patterns, framework-specific code
5. Include testing if: new business logic, changed critical paths (NOT for test files)
6. Include architecture if: new classes/modules, significant refactors
7. Include readability if: complex/nested logic

**Priority Levels:**
- critical: auth, payment, security-sensitive files
- high: API routes, database models, core business logic
- normal: utilities, components, helpers
- low: tests, configs, documentation

Analyze the file and return a plan with provided responseFormat.`;

const { modelId, apiKey } = getLLMConfig();
const model = await initChatModel(modelId, {
    apiKey: apiKey,
});

export const coordinatorAgent = createAgent({
    name: "coordinator-agent",
    model,
    systemPrompt: prompt,
    responseFormat: coordinatorSchema
});