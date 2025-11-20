import { END, START, StateGraph } from "@langchain/langgraph";
import { ReviewState } from "./state";
import { nodes } from "./nodes";
import { edges } from "./edges";

export const codeReviewGraph = new StateGraph(ReviewState)
    .addNode("splitIntoChunks", nodes.splitIntoChunks)
    .addNode("reviewEachChunk", nodes.reviewEachChunk)        // ← this is the .map() version!
    .addNode("finalizeReview", nodes.finalizeReview)
    /* ─────────────── ALL THE CONNECTIONS ───────────────  */
    .addEdge(START, "splitIntoChunks")
    .addConditionalEdges(
        "splitIntoChunks",
        edges.routeChunksToReview,
        ["reviewEachChunk"]
    )
    .addEdge("reviewEachChunk", "finalizeReview")
    .addEdge("finalizeReview", END)
    .compile();
