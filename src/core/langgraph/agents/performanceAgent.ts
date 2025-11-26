import { makeAgent } from "./makeAgent.ts";

const prompt = `You are a senior Software performance Engineer.
Audit:
- N+1 queries
- Inefficient algorithms
- Memory leaks
- Unnecessary allocations
- Missing indexes
- Blocking operations
- API misuse
- Race conditions
- Infinite loops
`;

export const performanceAgent = makeAgent({
    name: "performance-agent",
    systemPrompt: prompt
});