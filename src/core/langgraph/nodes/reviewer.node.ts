import { agentConcurrency } from "../../../config/concurrency.ts";
import { shouldSkipFile, isSimpleChange, getFilePriority, AGENT_MAP } from "../../../utils/helper.ts";
import type { IReviewerNodes } from "../interface/IReviewer.nodes.ts";
import type { ReviewState } from "../states/state.ts";
import { Priority, Severity, type AgentPlan, type Chunk, type FileContext } from "../utils/types.ts";
import { ContextEnricher } from "../utils/context-enricher.ts";
import { coordinatorAgent } from "../agents/coordinator.agent.ts";

export class ReviewerNodes implements IReviewerNodes {
    private contextEnricher = new ContextEnricher();

    // ============================================
    // PHASE 1: Split and Enrich Context
    // ============================================
    splitAndEnrichChunks(state: typeof ReviewState.State): Partial<typeof ReviewState.State> {
        try {
            const input = state.rawInput.trim();
            const chunks: FileContext[] = [];

            if (input.startsWith("diff --git") || input.includes("diff --git")) {
                const fileSections = input
                    .split(/diff --git /)
                    .filter(Boolean)
                    .map((section: any) => `diff --git ${section}`);

                fileSections.forEach((content: string, i: number) => {
                    const filenameMatch = content.match(/ b\/(.+?)(\s|$)/);
                    const filename = filenameMatch ? filenameMatch[1] : `file_${i}`;

                    // Skip unwanted files
                    if (shouldSkipFile(filename)) {
                        console.log(`⏭️  Skipping: ${filename}`);
                        return;
                    }

                    // Skip simple changes (whitespace, comments only)
                    if (isSimpleChange(content)) {
                        console.log(`⏭️  Skipping simple change: ${filename}`);
                        return;
                    }

                    // Create basic chunk
                    const basicChunk: Chunk = {
                        id: `${i}`,
                        filename,
                        content,
                    };

                    // Enrich with full context
                    const enrichedChunk = this.contextEnricher.enrichChunk(basicChunk);
                    chunks.push(enrichedChunk);

                    console.log(`✅ Enriched: ${filename} (${enrichedChunk.linesAdded}+ ${enrichedChunk.linesRemoved}-)`);
                });

                // Sort by priority (critical files first)
                chunks.sort((a, b) => {
                    const priorityA = getFilePriority(a.filename);
                    const priorityB = getFilePriority(b.filename);
                    return priorityB - priorityA;
                });

                console.log(`\n📦 Total files to review: ${chunks.length}`);
                return { chunks };
            } else {
                // Single snippet (not a diff)
                const basicChunk: Chunk = {
                    id: "0",
                    filename: "snippet.txt",
                    content: input,
                };
                const enrichedChunk = this.contextEnricher.enrichChunk(basicChunk);
                return { chunks: [enrichedChunk] };
            }
        } catch (error) {
            console.error("❌ Error in splitAndEnrichChunks:", error);
            return { chunks: [] };
        }
    }

    // ============================================
    // PHASE 2: Coordinator Plans Review (NEW)
    // ============================================
    async coordinateReview(state: { chunkData: FileContext }): Promise<Partial<typeof ReviewState.State>> {
        const { chunkData } = state;

        try {
            console.log(`\n🧭 Coordinating review for: ${chunkData.filename}`);

            // Build context for coordinator
            const coordinatorInput = `
            **File:** ${chunkData.filename}
            **Type:** ${chunkData.fileType}
            **Lines Changed:** +${chunkData.linesAdded} -${chunkData.linesRemoved}
            **Functions Changed:** ${chunkData.functionsChanged.join(', ') || 'None'}
            **Classes Changed:** ${chunkData.classesChanged.join(', ') || 'None'}
            **Has Tests:** ${chunkData.hasTests ? 'Yes' : 'No'}

            **Diff Summary (first 500 chars):**
            ${chunkData.diff.slice(0, 500)}
            ${chunkData.diff.length > 500 ? '...' : ''}
            `;

            const result = await coordinatorAgent.invoke({
                messages: [{ role: "user", content: coordinatorInput }]
            });

            const lastContent = result.messages.at(-1)?.content;
            let plan: AgentPlan;

            if (typeof lastContent === "string") {
                const sanitized = lastContent.replace(/```(json)?/g, '').trim();
                const parsed = JSON.parse(sanitized);

                plan = {
                    filename: chunkData.filename,
                    agents: parsed.agents || [],
                    priority: parsed.priority || Priority.NORMAL,
                    reasoning: parsed.reasoning || 'No reasoning provided'
                };

                console.log(`   Agents selected: ${plan?.agents?.join(', ')}`);
                console.log(`   Priority: ${plan?.priority}`);
                console.log(`   Reasoning: ${plan?.reasoning}`);
            } else {
                // Fallback: run all agents
                plan = {
                    filename: chunkData.filename,
                    agents: ['security', 'performance', 'bugs', 'idiomatic'],
                    priority: Priority.NORMAL,
                    reasoning: 'Coordinator failed, running default agents'
                };
            }

            return { agentPlans: [plan] };
        } catch (error) {
            console.error(`❌ Coordinator error for ${chunkData.filename}:`, error);

            // Fallback plan
            return {
                agentPlans: [{
                    filename: chunkData.filename,
                    agents: ['security', 'performance'],
                    priority: Priority.NORMAL,
                    reasoning: 'Error in coordinator, using fallback agents'
                }]
            };
        }
    }

    // ============================================
    // PHASE 3: Review with Selected Agents
    // ============================================
    async reviewWithAgents(state: {
        chunkData: FileContext;
        plan: AgentPlan;
    }): Promise<Partial<typeof ReviewState.State>> {
        const { chunkData, plan } = state;

        if (!plan || plan.agents.length === 0) {
            console.log(`⏭️  No agents selected for ${chunkData.filename}`);
            return { reviews: [] };
        }

        try {
            console.log(`\n🔍 Reviewing ${chunkData.filename} with agents: ${plan.agents.join(', ')}`);

            // Build rich context for agents
            const contextForAgents = `
            **File:** ${chunkData.filename}
            **Type:** ${chunkData.fileType}
            **Priority:** ${plan.priority}

            **Git Diff:**
            \`\`\`diff
            ${chunkData.diff}
            \`\`\`

            ${chunkData.contentAfter ? `
            **Full File Context (after changes):**
            \`\`\`
            ${chunkData.contentAfter}
            \`\`\`
            ` : ''}

            **Metadata:**
            - Lines added: ${chunkData.linesAdded}
            - Lines removed: ${chunkData.linesRemoved}
            - Functions changed: ${chunkData.functionsChanged.join(', ') || 'None'}
            - Classes changed: ${chunkData.classesChanged.join(', ') || 'None'}
            - Has tests: ${chunkData.hasTests ? 'Yes' : 'No'}
            - Imports added: ${chunkData.importsAdded.join(', ') || 'None'}

            Focus your review on the changed code sections.
            `;

            // Run selected agents in parallel
            const agentPromises = plan.agents.map(agentName => {
                const agent = AGENT_MAP[agentName];
                if (!agent) {
                    console.warn(`⚠️  Agent not found: ${agentName}`);
                    return Promise.resolve(null);
                }

                return agentConcurrency(() =>
                    agent.invoke({
                        messages: [{ role: "user", content: contextForAgents }]
                    })
                );
            });

            const results = await Promise.allSettled(agentPromises);

            // Process results
            const allReviews = results.map((res, index) => {
                const agentName = plan.agents[index];

                if (res.status === "fulfilled" && res.value) {
                    const messages = res.value?.messages;
                    const lastContent = messages?.at(-1)?.content;
                    let issues = [];

                    if (typeof lastContent === "string" && lastContent.trim()) {
                        try {
                            const sanitized = lastContent.replace(/```(json|diff)?/g, '').trim();
                            const parsed = JSON.parse(sanitized);
                            issues = parsed.issues || [];

                            // Filter to only high/critical for noise reduction
                            issues = issues.filter((issue: any) =>
                                issue.severity === Severity.HIGH || issue.severity === Severity.CRITICAL
                            );

                            console.log(`   ${agentName}: Found ${issues.length} high/critical issues`);
                        } catch (err) {
                            console.error(`❌ Failed to parse ${agentName} output:`, err);
                        }
                    }

                    return {
                        chunkId: chunkData.id,
                        filename: chunkData.filename,
                        agentType: agentName,
                        issues
                    };
                } else {
                    console.error(`❌ ${agentName} failed:`, res.status === 'rejected' ? res.reason : 'Unknown error');
                    return {
                        chunkId: chunkData.id,
                        filename: chunkData.filename,
                        agentType: agentName,
                        issues: []
                    };
                }
            });

            // Filter out empty reviews
            const filteredReviews = allReviews.filter(r => r.issues?.length > 0);

            return { reviews: filteredReviews };
        } catch (error) {
            console.error(`❌ Error reviewing ${chunkData.filename}:`, error);
            return { reviews: [] };
        }
    }

    // ============================================
    // PHASE 4: Synthesize Final Review (UPDATED)
    // ============================================
    async finalizeReview(state: typeof ReviewState.State): Promise<Partial<typeof ReviewState.State>> {
        try {
            console.log(`\n📊 Synthesizing final review...`);

            const allIssues = state.reviews.flatMap(r => r.issues);

            if (allIssues.length === 0) {
                return {
                    finalReview: {
                        summary: {
                            totalIssues: 0,
                            totalFilesReviewed: 0,
                            [Severity.CRITICAL]: 0,
                            [Severity.MEDIUM]: 0,
                            [Severity.HIGH]: 0,
                            [Severity.LOW]: 0
                        },
                        findings: [],
                        verdict: "No issues found!"
                    }
                };
            }
            const totalFileReviewed: Record<string, number> = {};

            const findings = state.reviews?.map(review => {
                if (!totalFileReviewed[review.filename]) {
                    totalFileReviewed[review.filename] = 1;
                }
                return {
                    file: review.filename,
                    agent: review.agentType,
                    issues: review.issues
                };
            });

            const finalReview = {
                summary: {
                    totalIssues: allIssues.length,
                    totalFilesReviewed: Object.keys(totalFileReviewed).length,
                    [Severity.CRITICAL]: allIssues.filter(i => i.severity === Severity.CRITICAL).length,
                    [Severity.HIGH]: allIssues.filter(i => i.severity === Severity.HIGH).length,
                    [Severity.MEDIUM]: allIssues.filter(i => i.severity === Severity.MEDIUM).length,
                    [Severity.LOW]: allIssues.filter(i => i.severity === Severity.LOW).length,
                },
                findings
            };
            return {
                finalReview
            };
        } catch (error) {
            console.error("❌ Error in finalizeReview:", error);
            return {
                finalReview: {
                    summary: {
                        totalIssues: 0,
                        totalFilesReviewed: 0,
                        [Severity.CRITICAL]: 0,
                        [Severity.MEDIUM]: 0,
                        [Severity.HIGH]: 0,
                        [Severity.LOW]: 0
                    },
                    findings: [],
                    verdict: "Error in finalizeReview"
                },
            };
        }
    }
}