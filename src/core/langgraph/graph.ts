import { inject, injectable } from "inversify";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { ReviewState } from "./states/state.ts";
import { edges } from "./edges/edges.ts";
import { TYPES } from "../../config/types.ts";
import type { IReviewerNodes } from "./interface/IReviewer.nodes.ts";
import type { IGraphBuilder } from "./interface/IGraphBuilder.ts";
import type { Chunk } from "./utils/types.ts";

const checkpointer = new MemorySaver();
@injectable()
export class CodeReviewerGraph implements IGraphBuilder {
    private graph: any = null;
    constructor(
        @inject(TYPES.IReviewerNodes) private reviewerNodes: IReviewerNodes
    ) { }

    private buildGraph() {
        const builder = new StateGraph(ReviewState)
            .addNode("splitIntoChunks", (state) => this.reviewerNodes.splitIntoChunks(state))
            .addNode("reviewEachChunk", (state: { chunkData: Chunk }) => this.reviewerNodes.reviewEachChunk(state))
            .addNode("finalizeReview", (state) => this.reviewerNodes.finalizeReview(state))
            /* ─────────────── ALL THE CONNECTIONS ───────────────  */
            .addEdge(START, "splitIntoChunks")
            .addConditionalEdges(
                "splitIntoChunks",
                edges.routeChunksToReview,
                ["reviewEachChunk"]
            )
            .addEdge("reviewEachChunk", "finalizeReview")
            .addEdge("finalizeReview", END);

        this.graph = builder.compile({ checkpointer });
        return this.graph;
    }

    getGraph() {
        if (!this.graph) return this.buildGraph();
        return this.graph;
    }
}