// graph/states/state.ts
import { Annotation } from "@langchain/langgraph";
import { type FileContext, type AgentPlan, type Review, type FinalizeReview, Severity } from "../utils/types.ts";

export const ReviewState = Annotation.Root({
    // Input
    rawInput: Annotation<string>,

    // Phase 1: Split & Enrich
    chunks: Annotation<FileContext[]>({
        reducer: (state, update) => update,
        default: () => []
    }),

    // Phase 2: Coordinator plans (NEW)
    agentPlans: Annotation<AgentPlan[]>({
        reducer: (state, update) => [...state, ...update],
        default: () => []
    }),

    // Phase 3: Reviews
    reviews: Annotation<Review[]>({
        reducer: (state, update) => [...state, ...update],
        default: () => []
    }),

    // Phase 4: Final output
    finalReview: Annotation<FinalizeReview>({
        reducer: (state, update) => update,
        default: () => ({
            summary: {
                totalIssues: 0,
                [Severity.CRITICAL]: 0,
                [Severity.MEDIUM]: 0,
                [Severity.HIGH]: 0,
                [Severity.LOW]: 0
            },
            findings: []
        })
    })
});