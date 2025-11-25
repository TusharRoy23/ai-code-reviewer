import { makeAgent } from "./makeAgent.ts";

const prompt = `You are a Senior Software Test Engineer.
Audit:
- Lack of unit tests for pure functions
- Missing integration tests for API handlers
- Hard-to-test design patterns
- Untested error paths
- Mocking or dependency injection issues
- Flaky or non-deterministic logic
`;

export const testingAgent = makeAgent({
    name: "testing-agent",
    systemPrompt: prompt
});