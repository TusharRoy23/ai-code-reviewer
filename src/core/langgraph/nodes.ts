// src/graph.ts
import { ReviewState, type Chunk } from "./state";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// ──────────────────────────────
// 1. LLM SETUP
// ──────────────────────────────
const llm = new ChatOpenAI({
    model: "gpt-4o-mini", // change to "claude-3-5-sonnet-20241022" or "grok-4" as you wish
    temperature: 0.2,
});

// ──────────────────────────────
// 2. ZOD SCHEMA FOR STRUCTURED REVIEW
// ──────────────────────────────
const IssueSchema = z.object({
    severity: z.enum(["critical", "high", "medium", "low", "info"]),
    title: z.string(),
    description: z.string(),
    suggestion: z.string().nullable().default(null),
    lineStart: z.number().nullable().default(null),
    lineEnd: z.number().nullable().default(null),
});

const ChunkReviewSchema = z.object({
    filename: z.string(),
    overallScore: z.number().min(1).max(10).default(0),
    summary: z.string(),
    issues: z.array(IssueSchema),
});

// ──────────────────────────────
// 3. SPLIT NODE – turns raw input into chunks
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
// 4. REVIEW EACH CHUNKS NODE
// ──────────────────────────────
const sysPrompt = `You are an expert code reviewer.
Review ONLY the provided code/diff. Be concise but thorough.
Focus on correctness, security, performance, readability, and best practices.

Return your answer as JSON exactly matching this shape:
{{
  "filename": "<string>",
  "overallScore": <number 1-10 or null>,
  "summary": "<string>",
  "issues": [
    {{
      "severity": "critical|high|medium|low|info",
      "title": "<string>",
      "description": "<string>",
      "suggestion": "<string or null>",
      "lineStart": <number or null>,
      "lineEnd": <number or null>
    }}
  ]
}}
Do not wrap in markdown or add explanations outside the JSON.`;

const reviewPrompt = ChatPromptTemplate.fromMessages([
    ["system", sysPrompt],
    ["human", "Filename: {filename}\n\n{code}"],
]);


const reviewChain = reviewPrompt.pipe(
    llm.withStructuredOutput(ChunkReviewSchema)
);

async function reviewEachChunk(state: { chunkData: Chunk }) {
    // Access the chunk data from state
    const chunkData = state.chunkData;

    if (!chunkData) {
        console.error("No chunk data provided");
        return { reviews: [] };
    }

    const result = await reviewChain.invoke({
        filename: chunkData.filename,
        code: chunkData.content,
    });

    // Return as array so reducer can accumulate
    return {
        reviews: [
            {
                chunkId: chunkData.id,
                filename: chunkData.filename,
                overallScore: result.overallScore,
                summary: result.summary,
                issues: result.issues || [],
            },
        ],
    };
}

async function finalizeReview(state: typeof ReviewState.State) {
    // All reviews are now accumulated in state.reviews
    const reviewsJson = JSON.stringify(state.reviews, null, 2);

    // Build your final markdown here
    return {
        finalReview: `## Code Review Summary\n\n${reviewsJson}`,
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

