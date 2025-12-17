import { inject, injectable } from "inversify";
import { v4 as uuidv4 } from "uuid";
import type { IReviewerRepository } from "../interface/IReviewer.repository.ts";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";
import { TYPES } from "../../../config/types.ts";
import type { IGraphBuilder } from "../../../core/langgraph/interface/IGraphBuilder.ts";
import type { FinalizeReview } from "../../../core/langgraph/utils/types.ts";
import type { ConversationPayloadType } from "../dto/conversation-payload.dto.ts";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts"

const threadResponseSchema = z.object({
    response: z.string()
});

@injectable()
export class ReviewerRepository implements IReviewerRepository {
    private graph: any;
    private openAIChat: ChatOpenAI;

    constructor(
        @inject(TYPES.IGraphBuilder) private readonly codeReviewerBuilder: IGraphBuilder
    ) {
        this.graph = this.codeReviewerBuilder.getGraph();
        this.openAIChat = new ChatOpenAI({
            modelName: "gpt-4o-mini",
            temperature: 0.5,
        });
    }

    async requestForReview(payload: ReviewPayloadType): Promise<FinalizeReview> {
        try {
            const result = await this.graph.invoke({
                rawInput: payload.code
            }, { configurable: { thread_id: uuidv4() } });
            const data = result.finalReview;
            return data;
        } catch (error) {
            throw error;
        }
    }

    async generateThreadConversation(payload: ConversationPayloadType): Promise<string> {
        try {
            const modelWithSchema = this.openAIChat.withStructuredOutput(threadResponseSchema);
            const promptTemplate = await ChatPromptTemplate.fromMessages([
                [
                    "system",
                    `You are an expert code review assistant who is helping developer to understand a code review thread.
                    Your role:
                    - Answer the questions about code review findings
                    - Understand the origin of the comments and provide context
                    - Provide clear and concise explanations
                    - Acknowledge previous comments in the thread`
                ],
                [
                    "user",
                    this.buildUserPrompt(payload)
                ]
            ]);
            const chain = promptTemplate.pipe(modelWithSchema);
            const response = await chain.invoke({})
            return response.response;
        } catch (error) {
            throw error;
        }
    }

    private buildUserPrompt(payload: ConversationPayloadType): string {
        const { conversationContext, codeContext, prContext } = payload;

        let prompt = `You are having a conversation about a code review on a Pull Request.
        ## PR CONTEXT`;

        if (prContext) {
            prompt += `
            - **Title**: ${prContext.title}
            - **Description**: ${prContext.description || 'N/A'}
            - **Changed Files**: ${prContext.changedFiles.length} files
            - **Changes**: +${prContext.totalAdditions} -${prContext.totalDeletions}`;
        }

        if (codeContext) {
            prompt += `
                ## CODE BEING DISCUSSED

                **File**: \`${codeContext.filePath}\`
                **Language**: ${codeContext.language}
                **Line**: ${codeContext.targetLine}

                ### The Change (Diff):
                \`\`\`diff
                ${codeContext.diffHunk.raw}
                \`\`\`
            `;
            // Add surrounding context if available
            if (codeContext.surroundingLines && codeContext.surroundingLines.length > 0) {
                prompt += `
                ### Surrounding Code Context:
                \`\`\`${codeContext.language}
                ${codeContext.surroundingLines
                        .map(l => `${l.lineNumber}: ${l.isTarget ? '→ ' : '  '}${l.content}`)
                        .join('\n')}
                \`\`\`
                `;
            }

            // Add full file diff if available
            if (codeContext.fullFileDiff) {
                prompt += `
                ### Full File Changes:
                \`\`\`diff
                ${codeContext.fullFileDiff}
                \`\`\`
                `;
            }
        }
        prompt += `## CONVERSATION HISTORY
        `;
        // Add conversation thread
        for (const msg of conversationContext.thread) {
            const role = msg.isAI ? '**AI Code Reviewer**' : `**${msg.author}**`;
            prompt += `${role}: ${msg.body}\n\n`;
        }
        prompt += `## CURRENT QUESTION
                **${conversationContext.currentQuestion.author}** asks: ${conversationContext.currentQuestion.body}
                ---
                Please provide a helpful response that:
                1. Directly answers the question asked
                2. References the specific code being discussed
                3. Acknowledges and builds on previous conversation points
                4. Explains technical concepts clearly
                5. Provides concrete suggestions or examples if relevant
                6. Stays focused on the issue at hand

                Your response:`;
        return prompt;
    }
}