import { Send } from "@langchain/langgraph";
import type { ReviewState } from "./state";

function routeChunksToReview(state: typeof ReviewState.State) {
    /*
        DOC URL: https://docs.langchain.com/oss/javascript/langgraph/graph-api#send
        Why Send: To prepare dynamic nodes. In the graph it will be like this - 
        addEdge("splitIntoChunks", ["reviewEachChunk", reviewEachChunk], reviewEachChunk, ....)
        /? This example just to understand the visualization
    */
    // Send chunk to reviewChunk parallelly
    return state.chunks.map((chunk) => new Send("reviewEachChunk", { chunkData: chunk }));
}

export const edges = {
    routeChunksToReview,
};