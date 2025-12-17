import { z, string, number, array, object, boolean } from "zod";

// Individual message in the thread
const ThreadMessageDto = z.object({
    id: number(),
    author: string(),
    body: string(),
    createdAt: string(),
    isAI: boolean()
});

// Root comment (bot's original review)
const RootCommentDto = z.object({
    id: number(),
    author: string(),
    body: string(),
    isAI: boolean(),
    filePath: string(),
    line: number(),
    diffHunk: string(),
    createdAt: string()
});

// Current question being asked
const CurrentQuestionDto = z.object({
    body: string(),
    author: string(),
    createdAt: string()
});

// Conversation context
const ConversationContextDto = z.object({
    prNumber: number(),
    commentId: number(),
    type: z.enum(["inline", "general"]),
    currentQuestion: CurrentQuestionDto,
    thread: array(ThreadMessageDto),
    rootComment: RootCommentDto
});

// Code context (diff, file, surrounding lines)
const DiffLineDto = z.object({
    type: z.enum(["header", "added", "removed", "context"]),
    content: string()
});

const SurroundingLineDto = z.object({
    lineNumber: number(),
    content: string(),
    isTarget: boolean()
});

const CodeContextDto = z.object({
    filePath: string(),
    language: string(),
    targetLine: number(),
    diffHunk: object({
        raw: string(),
        parsed: array(DiffLineDto)
    }),
    fullFileDiff: string().nullable(),
    surroundingLines: array(SurroundingLineDto).nullable(),
    fullFileContent: string().nullable().optional(),
    fullFileContentTruncated: boolean().optional()
});

// PR context (broader picture)
const ChangedFileDto = z.object({
    path: string(),
    status: string(),
    additions: number(),
    deletions: number(),
    changes: number()
});

const PRContextDto = z.object({
    title: string(),
    description: string().nullable(),
    state: string(),
    author: string(),
    baseBranch: string(),
    headBranch: string(),
    changedFiles: array(ChangedFileDto),
    totalAdditions: number(),
    totalDeletions: number(),
    commits: number()
});

// Main payload for conversation API
export const ConversationPayloadDto = z.object({
    conversationContext: ConversationContextDto,
    codeContext: CodeContextDto.nullable(),
    prContext: PRContextDto.nullable()
});

export type ConversationPayloadType = z.infer<typeof ConversationPayloadDto>;
export type ThreadMessageType = z.infer<typeof ThreadMessageDto>;
export type CodeContextType = z.infer<typeof CodeContextDto>;
export type PRContextType = z.infer<typeof PRContextDto>;