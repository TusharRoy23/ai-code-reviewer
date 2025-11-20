import { Send } from "@langchain/langgraph";
import type { ReviewState } from "./state";

function routeChunksToReview(state: typeof ReviewState.State) {
    // Send chunk to reviewChunk parallelly
    return state.chunks.map((chunk) => new Send("reviewEachChunk", { chunkData: chunk }));
}

export const edges = {
    routeChunksToReview,
};