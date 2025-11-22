import { architectureAgent } from "../core/langgraph/agents/architectureAgent";
import { correctnessAgent } from "../core/langgraph/agents/correctnessAgent";
import { idiomaticAgent } from "../core/langgraph/agents/idiomaticAgent";
import { performanceAgent } from "../core/langgraph/agents/performanceAgent";
import { readabilityAgent } from "../core/langgraph/agents/readabilityAgent";
import { securityAgent } from "../core/langgraph/agents/securityAgent";
import { testingAgent } from "../core/langgraph/agents/testingAgent";

export const reviewAgents = [
    { name: "security", agent: securityAgent },
    { name: "correctness", agent: correctnessAgent },
    { name: "performance", agent: performanceAgent },
    { name: "testing", agent: testingAgent },
    { name: "readability", agent: readabilityAgent },
    { name: "idiomatic", agent: idiomaticAgent },
    { name: "architecture", agent: architectureAgent },
];