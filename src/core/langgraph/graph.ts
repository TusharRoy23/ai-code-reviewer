import { END, START, StateGraph } from "@langchain/langgraph";
import { ReviewState } from "./state.ts";
import { nodes } from "./nodes.ts";
import { edges } from "./edges.ts";

export const codeReviewGraph = new StateGraph(ReviewState)
    .addNode("splitIntoChunks", nodes.splitIntoChunks)
    .addNode("reviewEachChunk", nodes.reviewEachChunk)
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
