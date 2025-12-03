import { agentConcurrency } from "../../../config/concurrency.ts";
import { shouldSkipFile, isSimpleChange, getFilePriority, AGENT_MAP } from "../../../utils/helper.ts";
import type { IReviewerNodes } from "../interface/IReviewer.nodes.ts";
import type { ReviewState } from "../states/state.ts";
import { Priority, Severity, type AgentPlan, type Chunk, type FileContext, type SecurityContext } from "../utils/types.ts";
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
                    const filename = filenameMatch ? filenameMatch[1] : null;
                    if (filename) {
                        // Skip unwanted files
                        if (shouldSkipFile(filename)) {
                            return;
                        }

                        // Skip simple changes (whitespace, comments only)
                        if (isSimpleChange(content)) {
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
                    }
                });

                // Sort by priority (critical files first)
                chunks.sort((a, b) => {
                    const priorityA = getFilePriority(a.filename);
                    const priorityB = getFilePriority(b.filename);
                    return priorityB - priorityA;
                });

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
    // PHASE 2: Coordinator Plans Review
    // ============================================
    async coordinateReview(state: { chunkData: FileContext }): Promise<Partial<typeof ReviewState.State>> {
        const { chunkData } = state;

        try {
            // Build context for coordinator
            const coordinatorInput = `
            **File:** ${chunkData.filename}
            **Type:** ${chunkData.fileType}
            **Lines Changed:** +${chunkData.linesAdded} -${chunkData.linesRemoved}
            **Functions Changed:** ${chunkData.functionsChanged.join(', ') || 'None'}
            **Classes Changed:** ${chunkData.classesChanged.join(', ') || 'None'}
            **Has Tests:** ${chunkData.hasTests ? 'Yes' : 'No'}

            **Diff Summary (first 1000 chars):**
            ${chunkData.diff.slice(0, 1000)}
            ${chunkData.diff.length > 1000 ? '...' : ''}
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
            return { reviews: [] };
        }

        try {
            // ============================================
            // BUILD SMART CONTEXT FOR AGENTS
            // ============================================
            const smartContext = this.buildSmartContext(chunkData, plan);

            // Run selected agents in parallel
            const agentPromises = plan.agents.map(agentName => {
                const agent = AGENT_MAP[agentName];
                if (!agent) {
                    console.warn(`Agent not found: ${agentName}`);
                    return Promise.resolve(null);
                }

                return agentConcurrency(() =>
                    agent.invoke({
                        messages: [{ role: "user", content: smartContext }]
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
                        } catch (err) {
                            console.error(`Failed to parse ${agentName} output:`, err);
                        }
                    }

                    return {
                        chunkId: chunkData.id,
                        filename: chunkData.filename,
                        agentType: agentName,
                        issues
                    };
                } else {
                    console.error(`${agentName} failed:`, res.status === 'rejected' ? res.reason : 'Unknown error');
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
            console.error(`Error reviewing ${chunkData.filename}:`, error);
            return { reviews: [] };
        }
    }

    // ============================================
    // PHASE 4: Synthesize Final Review (UPDATED)
    // ============================================
    async finalizeReview(state: typeof ReviewState.State): Promise<Partial<typeof ReviewState.State>> {
        try {
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

    // ============================================
    // BUILD SMART CONTEXT FOR AGENTS
    // ============================================
    private buildSmartContext(ctx: FileContext, plan: AgentPlan): string {
        const parts: string[] = [];

        // ============================================
        // HEADER SECTION
        // ============================================
        parts.push(`# Code Review Context`);
        parts.push(`**File:** ${ctx.filename}`);
        parts.push(`**Type:** ${ctx.fileType}${ctx.fileType === 'auth' ? 'CRITICAL' : ''}`);
        parts.push(`**Priority:** ${plan.priority}`);
        parts.push(`**Changes:** +${ctx.linesAdded} -${ctx.linesRemoved} lines`);
        parts.push('');

        this.securityContext(ctx, parts);
        this.modifiedFunctions(ctx, parts);
        this.typeDefinition(ctx, parts);
        this.callGraph(ctx, parts);
        this.checkImports(ctx, parts);
        this.getChangedBlocks(ctx, parts);
        this.getGitDiff(ctx, parts);
        this.getFullFileContext(ctx, parts);
        this.ifNoTests(ctx, parts);
        this.instructionForAgents(parts);

        return parts.join('\n');
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Check if security context has any concerns
     */
    private hasSecurityConcerns(ctx: SecurityContext): boolean {
        return ctx.hasUserInput ||
            ctx.hasDatabaseQuery ||
            ctx.hasAuthCode ||
            ctx.hasCryptoOperation ||
            ctx.hasFileOperation ||
            ctx.hasNetworkCall ||
            ctx.exposesAPI;
    }

    /**
     * Truncate text to max length
     */
    private truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.slice(0, maxLength) + '\n... (truncated)';
    }

    // ============================================
    // SECURITY CONTEXT (if relevant)
    // ============================================
    private securityContext(ctx: FileContext, parts: string[]) {
        if (ctx.securityContext && this.hasSecurityConcerns(ctx.securityContext)) {
            parts.push(`## Security Alert`);

            if (ctx.securityContext.hasUserInput) {
                parts.push(`- **User Input Detected** - Review for injection vulnerabilities`);
            }
            if (ctx.securityContext.hasDatabaseQuery) {
                parts.push(`- **Database Queries** - Check for SQL injection, parameterization`);
            }
            if (ctx.securityContext.hasAuthCode) {
                parts.push(`- **Authentication Code** - Critical security review required`);
            }
            if (ctx.securityContext.hasCryptoOperation) {
                parts.push(`- **Cryptography** - Verify secure algorithms (no MD5/SHA1)`);
            }
            if (ctx.securityContext.hasFileOperation) {
                parts.push(`- **File Operations** - Check for path traversal vulnerabilities`);
            }
            if (ctx.securityContext.hasNetworkCall) {
                parts.push(`- **Network Calls** - Verify SSL/TLS, input validation`);
            }
            if (ctx.securityContext.exposesAPI) {
                parts.push(`- **API Endpoint** - Ensure authentication, rate limiting, CORS`);
            }

            parts.push('');
        }
    }

    // ============================================
    // MODIFIED FUNCTIONS (with full bodies)
    // ============================================
    private modifiedFunctions(ctx: FileContext, parts: string[]) {
        if (ctx.functionDetails && ctx.functionDetails.length > 0) {
            parts.push(`## Modified Functions`);
            parts.push('');

            // Show only modified or new functions
            const relevantFunctions = ctx.functionDetails.filter(f => f.isModified || f.isNew);

            if (relevantFunctions.length > 0) {
                relevantFunctions.forEach(func => {
                    parts.push(`### \`${func.name}()\``);
                    parts.push(`- **Location:** Lines ${func.lineStart}-${func.lineEnd}`);
                    parts.push(`- **Complexity:** ${func.complexity || 'N/A'}`);
                    parts.push(`- **Status:** ${func.isNew ? '✨ NEW' : '🔄 MODIFIED'}`);

                    // Show signature
                    if (func.signature) {
                        parts.push(`- **Signature:** \`${func.signature}\``);
                    }

                    parts.push('');

                    // Show before/after for MODIFIED functions
                    if (!func.isNew && func.bodyBefore && func.bodyAfter) {
                        parts.push(`**Before:**`);
                        parts.push('```');
                        parts.push(this.truncate(func.bodyBefore, 200));
                        parts.push('```');
                        parts.push('');

                        parts.push(`**After:**`);
                        parts.push('```');
                        parts.push(this.truncate(func.bodyAfter, 200));
                        parts.push('```');
                    } else if (func.bodyAfter) {
                        // Show just the new function
                        parts.push(`**Code:**`);
                        parts.push('```');
                        parts.push(this.truncate(func.bodyAfter, 200));
                        parts.push('```');
                    }

                    parts.push('');
                });
            } else {
                parts.push('*(No complete function bodies available - see diff below)*');
                parts.push('');
            }
        }
    }

    // ============================================
    // TYPE DEFINITIONS (interfaces, types, classes)
    // ============================================
    private typeDefinition(ctx: FileContext, parts: string[]) {
        if (ctx.typeDefinitions && ctx.typeDefinitions.length > 0) {
            parts.push(`## Type Definitions`);
            parts.push('');

            ctx.typeDefinitions.forEach(type => {
                parts.push(`### ${type.name} (${type.kind})`);
                parts.push(`- **Line:** ${type.lineNumber}`);
                parts.push('```typescript');
                parts.push(this.truncate(type.definition, 500));
                parts.push('```');
                parts.push('');
            });
        }
    }

    // ============================================
    // CALL GRAPH (who calls whom)
    // ============================================
    private callGraph(ctx: FileContext, parts: string[]) {
        if (ctx.callGraph && ctx.callGraph.length > 0) {
            const changedFuncs = ctx.callGraph.filter(node => node.isChangedFunction);

            if (changedFuncs.length > 0) {
                parts.push(`## Call Graph (Changed Functions)`);
                parts.push('');

                changedFuncs.forEach(node => {
                    parts.push(`**${node.functionName}:**`);

                    if (node.calls.length > 0) {
                        parts.push(`  - ↓ Calls: ${node.calls.slice(0, 5).join(', ')}${node.calls.length > 5 ? '...' : ''}`);
                    }
                    if (node.calledBy.length > 0) {
                        parts.push(`  - ↑ Called by: ${node.calledBy.slice(0, 5).join(', ')}${node.calledBy.length > 5 ? '...' : ''}`);
                    }

                    parts.push('');
                });
            }
        }
    }

    // ============================================
    // IMPORTS (added/removed)
    // ============================================
    private checkImports(ctx: FileContext, parts: string[]) {
        if ((ctx.importsAdded && ctx.importsAdded.length > 0) ||
            (ctx.importsRemoved && ctx.importsRemoved.length > 0)) {
            parts.push(`## Import Changes`);

            if (ctx.importsAdded.length > 0) {
                parts.push(`**Added:** \`${ctx.importsAdded.join('`, `')}\``);
            }
            if (ctx.importsRemoved.length > 0) {
                parts.push(`**Removed:** \`${ctx.importsRemoved.join('`, `')}\``);
            }

            parts.push('');
        }
    }

    // ============================================
    // CHANGED CODE BLOCKS (clean additions/deletions)
    // ============================================
    private getChangedBlocks(ctx: FileContext, parts: string[]) {
        if (ctx.changedCode) {
            if (ctx.changedCode.additions.length > 0) {
                parts.push(`## Code Additions (${ctx.changedCode.additions.length} blocks)`);

                ctx.changedCode.additions.slice(0, 3).forEach((block, idx) => {
                    parts.push(`**Block ${idx + 1}:**`);
                    parts.push('```');
                    parts.push(this.truncate(block, 400));
                    parts.push('```');
                    parts.push('');
                });

                if (ctx.changedCode.additions.length > 3) {
                    parts.push(`*(${ctx.changedCode.additions.length - 3} more blocks omitted)*`);
                    parts.push('');
                }
            }

            if (ctx.changedCode.deletions.length > 0) {
                parts.push(`## Code Deletions (${ctx.changedCode.deletions.length} blocks)`);

                ctx.changedCode.deletions.slice(0, 2).forEach((block, idx) => {
                    parts.push(`**Block ${idx + 1}:**`);
                    parts.push('```');
                    parts.push(this.truncate(block, 300));
                    parts.push('```');
                    parts.push('');
                });
            }
        }
    }

    // ============================================
    // GIT DIFF (for reference)
    // ============================================
    private getGitDiff(ctx: FileContext, parts: string[]) {
        parts.push(`## Git Diff`);
        parts.push('```diff');
        parts.push(this.truncate(ctx.diff, 1500));
        if (ctx.diff.length > 1500) {
            parts.push('... (truncated for brevity)');
        }
        parts.push('```');
        parts.push('');
    }

    // ============================================
    // FULL FILE CONTEXT (if not too large)
    // ============================================
    private getFullFileContext(ctx: FileContext, parts: string[]) {
        if (ctx.contentAfter) {
            const fileSize = ctx.contentAfter.length;

            if (fileSize < 3000) {
                // Small file: include everything
                parts.push(`## Full File Context (${fileSize} chars)`);
                parts.push('```');
                parts.push(ctx.contentAfter);
                parts.push('```');
            } else if (fileSize < 10000) {
                // Medium file: include with truncation
                parts.push(`## Full File Context (truncated from ${fileSize} chars)`);
                parts.push('```');
                parts.push(this.truncate(ctx.contentAfter, 5000));
                parts.push('```');
            } else {
                // Large file: skip (already have function bodies)
                parts.push(`## Full File Context`);
                parts.push(`*File too large (${fileSize} chars) - function bodies shown above*`);
            }
            parts.push('');
        }
    }

    // ============================================
    // TESTING INFO
    // ============================================
    private ifNoTests(ctx: FileContext, parts: string[]) {
        if (!ctx.hasTests && ctx.fileType !== 'test' && ctx.fileType !== 'config') {
            parts.push(`---`);
            parts.push(`**No test file found** - Consider adding tests for new/changed functions`);
            parts.push('');
        }
    }

    // ============================================
    // INSTRUCTIONS FOR AGENT
    // ============================================
    private instructionForAgents(parts: string[]) {
        parts.push(`---`);
        parts.push(`## Review Instructions`);
        parts.push(`- Focus on the **changed code** (additions/modifications)`);
        parts.push(`- Use the **full function bodies** to understand context`);
        parts.push(`- Reference **line numbers** from the function details`);
        parts.push(`- Be **specific and actionable** in your findings`);
        parts.push(`- Only report **high confidence** issues`);
    }
}