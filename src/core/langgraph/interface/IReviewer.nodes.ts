import type { ReviewState } from "../states/state.ts";
import type { AgentPlan, FileContext } from "../utils/types.ts";

export interface IReviewerNodes {
    splitAndEnrichChunks(state: typeof ReviewState.State): Partial<typeof ReviewState.State>;
    coordinateReview(state: { chunkData: FileContext }): Promise<Partial<typeof ReviewState.State>>
    reviewWithAgents(state: { chunkData: FileContext; plan: AgentPlan; }): Promise<Partial<typeof ReviewState.State>>;
    finalizeReview(state: typeof ReviewState.State): Promise<Partial<typeof ReviewState.State>>;
}