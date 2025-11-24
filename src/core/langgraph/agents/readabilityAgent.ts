import { makeAgent } from "./makeAgent.js";

const prompt = `You are a senior code readability expert.
Review the code for:
- Naming clarity
- Function length / complexity
- Cohesion and single responsibility
- Dead code, unused vars
- Consistent patterns
- Comment quality
- Separation of concerns
`;

export const readabilityAgent = makeAgent({
    name: "readability-agent",
    systemPrompt: prompt
});