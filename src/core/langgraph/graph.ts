import { END, START, StateGraph } from "@langchain/langgraph";
import { ReviewState } from "./state.ts";
import { nodes } from "./nodes.ts";
import { edges } from "./edges.ts";
import { MAX_CONCURRENT_CHUNKS } from "../../config/concurrency.ts";

export const codeReviewGraph = new StateGraph(ReviewState)
    .addNode("splitIntoChunks", nodes.splitIntoChunks)
    .addNode("reviewEachChunk", nodes.reviewEachChunk)        // ← this is the .map() version!
    .addNode("finalizeReview", nodes.finalizeReview)
    // Increment batch index and route again
    // .addNode("routeNextBatch", (state) => ({
    //     batchIndex: state.batchIndex + 1,
    // }))
    /* ─────────────── ALL THE CONNECTIONS ───────────────  */
    .addEdge(START, "splitIntoChunks")
    .addConditionalEdges(
        "splitIntoChunks",
        edges.routeChunksToReview,
        ["reviewEachChunk"]
    )
    // After processing batch, check if more batches exist
    // .addConditionalEdges(
    //     "reviewEachChunk",
    //     (state) => {
    //         const nextBatchIndex = state.batchIndex + 1;
    //         const hasMoreBatches = (nextBatchIndex * MAX_CONCURRENT_CHUNKS) < state.chunks.length;

    //         return hasMoreBatches ? "routeNextBatch" : "finalizeReview";
    //     },
    //     ["routeNextBatch", "finalizeReview"]
    // )
    // .addEdge("routeNextBatch", "splitIntoChunks")
    .addEdge("reviewEachChunk", "finalizeReview")
    .addEdge("finalizeReview", END)
    .compile();
