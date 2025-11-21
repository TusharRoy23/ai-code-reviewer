import { ReviewState, type Chunk } from "./state";
import { ChatOpenAI } from "@langchain/openai";
import { securityAgent } from "./agents/securityAgent";
import { correctnessAgent } from "./agents/correctnessAgent";
import { performanceAgent } from "./agents/performanceAgent";
import { architectureAgent } from "./agents/architectureAgent";
import { idiomaticAgent } from "./agents/idiomaticAgent";
import { readabilityAgent } from "./agents/readabilityAgent";
import { testingAgent } from "./agents/testingAgent";

// ──────────────────────────────
// 1. LLM SETUP
// ──────────────────────────────
const llm = new ChatOpenAI({
    model: "gpt-4o-mini", // change to "claude-3-5-sonnet-20241022" or "grok-4" as you wish
    temperature: 0.2,
});

// ──────────────────────────────
// 2. SPLIT NODE – turns raw input into chunks
// ──────────────────────────────
async function splitIntoChunks(
    state: typeof ReviewState.State
) {
    try {
        const input = state.rawInput.trim();
        const chunks: Chunk[] = [];

        if (input.startsWith("diff --git") || input.includes("diff --git")) {
            const fileSections = input
                .split(/diff --git /)
                .filter(Boolean)
                .map((section) => `diff --git ${section}`);

            // Store chunks in state
            fileSections.forEach((content, i) => {
                const filenameMatch = content.match(/ b\/(.+?)(\s|$)/);
                chunks.push({
                    id: `${i}`,
                    filename: filenameMatch ? filenameMatch[1] : `file_${i}`,
                    content,
                });
            });
        } else {
            chunks.push({
                id: "0",
                filename: "snippet.txt",
                content: input,
            });
        }
        return { chunks };
    } catch (error) {
        return [];
    }
}

// ──────────────────────────────
// 3. REVIEW EACH CHUNKS NODE
// ──────────────────────────────
async function reviewEachChunk(state: { chunkData: Chunk }) {
    // Access the chunk data from state
    const chunkData = state.chunkData;

    if (!chunkData) {
        console.error("No chunk data provided");
        return { reviews: [] };
    }
    const results =
        await Promise.allSettled([
            securityAgent.invoke({ messages: [{ role: "user", content: chunkData.content }] }),
            correctnessAgent.invoke({ messages: [{ role: "user", content: chunkData.content }] }),
            performanceAgent.invoke({ messages: [{ role: "user", content: chunkData.content }] }),
            testingAgent.invoke({ messages: [{ role: "user", content: chunkData.content }] }),
            readabilityAgent.invoke({ messages: [{ role: "user", content: chunkData.content }] }),
            idiomaticAgent.invoke({ messages: [{ role: "user", content: chunkData.content }] }),
            architectureAgent.invoke({ messages: [{ role: "user", content: chunkData.content }] }),
        ]);

    const allReviews = results.map((res, index) => {
        const agentName = ["security", "correctness", "performance", "testing", "readability", "idiomatic", "architecture"][index];

        if (res.status === "fulfilled") {
            const messages = res.value?.messages;
            const lastContent = messages.at(-1)?.content;
            return {
                type: agentName,
                issues: typeof lastContent === "string" ? JSON.parse(lastContent)['issues'] : []
            };
        } else {
            return { type: agentName, issues: [], error: String(res.reason) };
        }
    });

    return {
        reviews: [
            {
                chunkId: chunkData.id,
                filename: chunkData.filename,
                issues: allReviews || [],
            },
        ],
    };
}

// ──────────────────────────────
// 3. BUILD FINAL REVIEW
// ──────────────────────────────
async function finalizeReview(state: typeof ReviewState.State) {
    // Build your final markdown here
    return {
        finalReview: `## Code Review Summary\n\n`,
    };
}

// ──────────────────────────────
// EXPORT NODES (to be used in graph definition)
// ──────────────────────────────
export const nodes = {
    splitIntoChunks,
    reviewEachChunk, // ← this enables parallel execution!
    finalizeReview,
};

