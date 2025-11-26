import { Send } from "@langchain/langgraph";
import type { ReviewState } from "./state.ts";

function routeChunksToReview(state: typeof ReviewState.State) {
    const { chunks, batchIndex } = state;

    // Get next 2 chunks (batch)
    // const BATCH_SIZE = 2;
    // const batchChunks = chunks.slice(
    //     batchIndex * BATCH_SIZE,
    //     (batchIndex + 1) * BATCH_SIZE
    // );

    // if (batchChunks.length === 0) {
    //     return [];  // All batches processed
    // }

    /*
        DOC URL: https://docs.langchain.com/oss/javascript/langgraph/graph-api#send
        Why Send: To prepare dynamic nodes. In the graph it will be like this - 
        addEdge("splitIntoChunks", ["reviewEachChunk", reviewEachChunk], reviewEachChunk, ....)
        /? This example just to understand the visualization
    */
    // Process up to 2 chunks in parallel
    return chunks.map((chunk) =>
        new Send("reviewEachChunk", { chunkData: chunk, projectContext: state.projectContext })
    );
}

export const edges = {
    routeChunksToReview,
};