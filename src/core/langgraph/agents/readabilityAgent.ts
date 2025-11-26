import { makeAgent } from "./makeAgent.ts";

const prompt = `You are a senior code readability expert.
Audit:
- Naming clarity
- Function length / complexity
- Cohesion and single responsibility
- Dead code, unused variables
- Consistent patterns
- Comment quality
- Separation of concerns
- Type mismatches
`;

export const readabilityAgent = makeAgent({
    name: "readability-agent",
    systemPrompt: prompt
});