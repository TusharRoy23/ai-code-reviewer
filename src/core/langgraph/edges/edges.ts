import { Send } from "@langchain/langgraph";
import type { ReviewState } from "../states/state.ts";

const routeChunksToReview = (state: typeof ReviewState.State) => {
    const { chunks } = state;

    /*
        DOC URL: https://docs.langchain.com/oss/javascript/langgraph/graph-api#send
        Why Send: To prepare dynamic nodes. In the graph it will be like this - 
        addEdge("splitIntoChunks", ["reviewEachChunk", reviewEachChunk], reviewEachChunk, ....)
        /? This example just to understand the visualization
    */
    // Process up to 2 chunks in parallel
    return chunks.map((chunk) =>
        new Send("reviewEachChunk", { chunkData: chunk })
    );
}

export const edges = {
    routeChunksToReview
};