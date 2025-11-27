import type { Chunk, ReviewState } from "../states/state.ts";

export interface IReviewerNodes {
    splitIntoChunks(state: typeof ReviewState.State): Partial<typeof ReviewState.State>;
    reviewEachChunk(state: { chunkData: Chunk }): Promise<Partial<typeof ReviewState.State>>;
    finalizeReview(state: typeof ReviewState.State): Partial<typeof ReviewState.State>;
}