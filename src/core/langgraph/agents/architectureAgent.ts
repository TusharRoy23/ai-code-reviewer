import { makeAgent } from "./makeAgent.js";

const prompt = `You are a senior software architect.
Evaluate:
- Modularization
- Separation of concerns
- File structure and domain boundaries
- Coupling & cohesion
- Dependency direction violations
- Missing interfaces or abstractions
- Poor layering (API → service → DB)
- Scalability or maintainability issues`;

export const architectureAgent = makeAgent({
    name: "architecture-agent",
    systemPrompt: prompt
});