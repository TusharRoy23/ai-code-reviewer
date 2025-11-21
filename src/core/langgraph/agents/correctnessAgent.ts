import { makeAgent } from "./makeAgent";

// agents/correctness-agent.ts
const prompt = `You are a correctness expert reviewing code.
Focus on:
- Logic errors
- Off-by-one bugs
- Null pointer/undefined handling
- Type mismatches
- API misuse
- Race conditions
- Infinite loops
- Boundary cases`;


export const correctnessAgent = makeAgent({
    name: "correctness-agent",
    systemPrompt: prompt
});
