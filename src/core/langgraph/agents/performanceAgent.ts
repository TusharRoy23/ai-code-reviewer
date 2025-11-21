import { makeAgent } from "./makeAgent";

const prompt = `You are a senior Software performance Engineer.
Analyze the code for testability and missing tests.
Focus on:
- N+1 queries
- Inefficient algorithms
- Memory leaks
- Unnecessary allocations
- Missing indexes
- Blocking operations`;

export const performanceAgent = makeAgent({
    name: "performance-agent",
    systemPrompt: prompt
});