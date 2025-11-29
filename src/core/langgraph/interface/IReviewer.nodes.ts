import type { ReviewState } from "../states/state.ts";
import type { Chunk } from "../utils/types.ts";

export interface IReviewerNodes {
    splitIntoChunks(state: typeof ReviewState.State): Partial<typeof ReviewState.State>;
    reviewEachChunk(state: { chunkData: Chunk }): Promise<Partial<typeof ReviewState.State>>;
    finalizeReview(state: typeof ReviewState.State): Partial<typeof ReviewState.State>;
}