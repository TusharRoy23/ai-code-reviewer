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
        reducer: (x: any, y: any) => y ?? x,
        default: () => "",
    }),
    // The exact text the user pasted: git diff, multiple files, or single snippet

    // ───────────────────────────────
    // INTERMEDIATE
    // ───────────────────────────────
    chunks: Annotation<Chunk[]>({
        reducer: (x: any, y: any) => y ?? x,
        default: () => [],
    }),

    reviews: Annotation<Review[]>({
        reducer: (x: any, y: any) => [...(x ?? []), ...(y ?? [])], // concat with the last review,
        default: () => [],
    }),
    // Structured reviews from the LLM (one per chunk)

    // ───────────────────────────────
    // FINAL OUTPUT
    // ───────────────────────────────
    finalReview: Annotation<string>({
        reducer: (x: any, y: any) => y ?? x,
        default: () => "",
    })
});