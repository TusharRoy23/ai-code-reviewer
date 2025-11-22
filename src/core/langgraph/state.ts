import { Annotation } from "@langchain/langgraph";

export type Issue = {
    severity: "critical" | "high" | "medium" | "low" | "info";
    type: string;
    description: string;
    recommendation?: string;
    lineStart?: number;
    lineEnd?: number;
}

export type Review = {
    chunkId: string;
    filename: string;
    issues: Issue[];
}

export type Chunk = {
    id: string;
    filename: string | undefined;
    content: string;
}

export const ReviewState = Annotation.Root({
    // ───────────────────────────────
    // INPUT (what the user gives us)
    // ───────────────────────────────
    rawInput: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),
    // The exact text the user pasted: git diff, multiple files, or single snippet

    // ───────────────────────────────
    // INTERMEDIATE
    // ───────────────────────────────
    chunks: Annotation<Chunk[]>({
        reducer: (x, y) => y ?? x,
        default: () => [],
    }),
    batchIndex: Annotation<number>({  // Which batch (Ex, 0, 2, 4, 6, ...)
        reducer: (x, y) => y ?? x,
        default: () => 0,
    }),

    reviews: Annotation<Review[]>({
        reducer: (x, y) => [...(x ?? []), ...(y ?? [])], // concat with the last review,
        default: () => [],
    }),
    // Structured reviews from the LLM (one per chunk)

    // ───────────────────────────────
    // FINAL OUTPUT
    // ───────────────────────────────
    finalReview: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),
    // The beautiful markdown comment ready to post on GitHub
});