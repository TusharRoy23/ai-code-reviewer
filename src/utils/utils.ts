import { architectureAgent } from "../core/langgraph/agents/architectureAgent.js";
import { correctnessAgent } from "../core/langgraph/agents/correctnessAgent.js";
import { idiomaticAgent } from "../core/langgraph/agents/idiomaticAgent.js";
import { performanceAgent } from "../core/langgraph/agents/performanceAgent.js";
import { readabilityAgent } from "../core/langgraph/agents/readabilityAgent.js";
import { securityAgent } from "../core/langgraph/agents/securityAgent.js";
import { testingAgent } from "../core/langgraph/agents/testingAgent.js";

export const reviewAgents = [
    { name: "security", agent: securityAgent },
    { name: "correctness", agent: correctnessAgent },
    { name: "performance", agent: performanceAgent },
    { name: "testing", agent: testingAgent },
    { name: "readability", agent: readabilityAgent },
    { name: "idiomatic", agent: idiomaticAgent },
    { name: "architecture", agent: architectureAgent },
];