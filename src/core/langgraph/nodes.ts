import { ReviewState, type Chunk } from "./state.ts";
import { ChatOpenAI } from "@langchain/openai";
import { agentConcurrency } from "../../config/concurrency.ts";
import { deduplicateIssues, getFilePriority, isSimpleChange, reviewAgents, selectAgentsForFile, shouldSkipFile } from "../../utils/helper.ts";
import { aggregateProjectContext, generateContextPrompt } from "../../utils/context.ts";

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
                .map((section: any) => `diff --git ${section}`);

            // Parse and filter chunks
            fileSections.forEach((content: string, i: number) => {
                const filenameMatch = content.match(/ b\/(.+?)(\s|$)/);
                const filename = filenameMatch ? filenameMatch[1] : `file_${i}`;

                // Skip unwanted files
                if (shouldSkipFile(filename)) {
                    return;
                }

                // Skip simple changes
                if (isSimpleChange(content)) {
                    return;
                }

                chunks.push({
                    id: `${i}`,
                    filename,
                    content,
                });
            });

            // DETECT PROJECT CONTEXT FROM ALL CHUNKS
            // console.log(`\n Detecting project context...`);
            // const globalProjectContext = aggregateProjectContext(chunks);
            // const projectContext = generateContextPrompt(globalProjectContext);
            // console.log(`Detected Context:\n${projectContext}`);

            // Sort by priority (review important files first)
            chunks.sort((a, b) =>
                getFilePriority(b.filename ?? "") - getFilePriority(a.filename ?? "")
            );

            return {
                chunks,
                // projectContext,
            };
        } else {
            // Single snippet (not a diff)
            chunks.push({
                id: "0",
                filename: "snippet.txt",
                content: input,
            });
            return { chunks };
        }
    } catch (error) {
        console.log('node error: ', error);
        return { chunks: [] };
    }
}

// ──────────────────────────────
// 3. REVIEW EACH CHUNKS NODE
// ──────────────────────────────
async function reviewEachChunk(state: { chunkData: Chunk, projectContext: string }) {
    const { chunkData, projectContext } = state;

    if (!chunkData) {
        console.error("No chunk data provided");
        return { reviews: [] };
    }

    // console.log(`Reviewing: ${chunkData.filename}`);

    // Smart agent selection based on file type
    const selectedAgents = selectAgentsForFile(chunkData.filename ?? "", chunkData.content);

    try {
        // Run selected agents in parallel
        const results = await Promise.allSettled(
            selectedAgents.map(({ agent }) =>
                agentConcurrency(() =>
                    agent.invoke({
                        messages: [
                            {
                                role: "user",
                                content: `${chunkData.content}`
                            }
                        ]
                    })
                )
            )
        );
        // ${projectContext}\nDIFF CODE:\n${chunkData.content}`

        const allReviews = results.map((res, index) => {
            const agentName = reviewAgents.at(index)?.name;
            if (res.status === "fulfilled") {
                const messages = res.value?.messages;
                const lastContent = messages.at(-1)?.content;
                let issues = [];

                if (typeof lastContent === "string" && lastContent.trim()) {
                    try {
                        // Remove Markdown fences ``` or ```json
                        const sanitized = lastContent.replace(/```(json|diff)?/g, '').trim();
                        const parsed = JSON.parse(sanitized);
                        issues = parsed.issues || [];

                        // Filter out low-severity issues for noise reduction
                        const beforeFilter = issues.length;
                        issues = issues.filter((issue: any) =>
                            issue.severity === 'high' ||
                            issue.severity === 'critical'
                        );

                        if (beforeFilter !== issues.length) {
                            // console.log(`  🔽 ${agentName}: filtered ${beforeFilter - issues.length} low/medium severity issues`);
                        }

                        // console.log(`  ✅ ${agentName}: found ${issues.length} high/critical issues`);
                    } catch (err) {
                        console.error(`  ❌ Failed to parse ${agentName} output:`, err);
                        // Log the problematic content for debugging
                        console.error(`  Raw content: ${lastContent.substring(0, 200)}...`);
                    }
                }
                return {
                    type: agentName,
                    issues
                };
            } else {
                console.error(`${agentName} failed:`, res.reason);
                return { type: agentName, issues: [], error: String(res.reason) };
            }
        });

        // Filter out empty reviews
        const filteredAllReviews = allReviews.filter(r => r.issues?.length > 0);

        // Deduplicate similar issues (reduce noise)
        const deduplicatedReviews = deduplicateIssues(filteredAllReviews);

        if (deduplicatedReviews.length === 0) {
            // console.log(`No significant issues found in ${chunkData.filename}`);
        }


        return {
            reviews: [
                {
                    chunkId: chunkData.id,
                    filename: chunkData.filename,
                    issues: deduplicatedReviews,
                },
            ],
        };
    } catch (error) {
        console.error(`Error reviewing chunk ${chunkData.filename}:`, error);
        return { reviews: [] };
    }
}

// ──────────────────────────────
// 3. BUILD FINAL REVIEW
// ──────────────────────────────
async function finalizeReview(state: typeof ReviewState.State) {
    // Build your final markdown here
    return {
        finalReview: state.reviews,
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

