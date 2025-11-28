import { agentConcurrency } from "../../../config/concurrency.ts";
import { shouldSkipFile, isSimpleChange, getFilePriority, selectAgentsForFile, reviewAgents, deduplicateIssues } from "../../../utils/helper.ts";
import type { IReviewerNodes } from "../interface/IReviewer.nodes.ts";
import type { ReviewState } from "../states/state.ts";
import type { Chunk } from "../utils/types.ts";

export class ReviewerNodes implements IReviewerNodes {
    splitIntoChunks(state: typeof ReviewState.State): Partial<typeof ReviewState.State> {
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

                // Sort by priority (review important files first)
                chunks.sort((a, b) =>
                    getFilePriority(b.filename ?? "") - getFilePriority(a.filename ?? "")
                );

                return {
                    chunks
                };
            } else {
                chunks.push({
                    id: "0",
                    filename: "snippet.txt",
                    content: input,
                });
                return { chunks };
            }
        } catch (error) {
            return { chunks: [] };
        }
    }

    async reviewEachChunk(state: { chunkData: Chunk; }): Promise<Partial<typeof ReviewState.State>> {
        const { chunkData } = state;

        if (!chunkData) {
            console.error("No chunk data provided");
            return { reviews: [] };
        }

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
                            issues = issues.filter((issue: any) =>
                                issue.severity === 'high' ||
                                issue.severity === 'critical'
                            );

                        } catch (err) {
                            console.error(`Failed to parse ${agentName} output:`, err);
                            // Log the problematic content for debugging
                            console.error(`Raw content: ${lastContent.substring(0, 200)}...`);
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

            return {
                reviews: [
                    {
                        chunkId: chunkData.id,
                        filename: chunkData.filename ?? '',
                        issues: deduplicatedReviews,
                    },
                ],
            };
        } catch (error) {
            console.error(`Error reviewing chunk ${chunkData.filename}:`, error);
            return { reviews: [] };
        }
    }

    finalizeReview(state: typeof ReviewState.State): Partial<typeof ReviewState.State> {
        return {
            finalReview: state.reviews.toString(), //! NEED TO CHECK THIS NODE
        };
    }
}