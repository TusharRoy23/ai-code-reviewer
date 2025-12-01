import { inject, injectable } from "inversify";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { ReviewState } from "./states/state.ts";
import { edges } from "./edges/edges.ts";
import { TYPES } from "../../config/types.ts";
import type { IReviewerNodes } from "./interface/IReviewer.nodes.ts";
import type { IGraphBuilder } from "./interface/IGraphBuilder.ts";
import type { AgentPlan, Chunk, FileContext } from "./utils/types.ts";

const checkpointer = new MemorySaver();

@injectable()
export class CodeReviewerGraph implements IGraphBuilder {
    private graph: any = null;

    constructor(
        @inject(TYPES.IReviewerNodes) private reviewerNodes: IReviewerNodes
    ) { }

    private buildGraph() {
        const builder = new StateGraph(ReviewState)
            // Phase 1: Split and enrich
            .addNode("splitAndEnrichChunks", (state) =>
                this.reviewerNodes.splitAndEnrichChunks(state))

            // Phase 2: Coordinator (one per file)
            .addNode("coordinateReview", (state: any) =>
                this.reviewerNodes.coordinateReview(state))

            // Phase 3: Review with agents (one per file)
            .addNode("reviewWithAgents", (state: any) =>
                this.reviewerNodes.reviewWithAgents(state))

            // Phase 4: Finalize
            .addNode("finalizeReview", (state) =>
                this.reviewerNodes.finalizeReview(state))

            /* ─────────────── CONNECTIONS ───────────────  */
            .addEdge(START, "splitAndEnrichChunks")

            // Route each file to coordinator
            .addConditionalEdges(
                "splitAndEnrichChunks",
                edges.routeToCoordinator,
                ["coordinateReview"]
            )

            // Route each file+plan to review
            .addConditionalEdges(
                "coordinateReview",
                edges.routeToReview,
                ["reviewWithAgents"]
            )

            // All reviews go to finalizer
            .addEdge("reviewWithAgents", "finalizeReview")
            .addEdge("finalizeReview", END);

        this.graph = builder.compile({ checkpointer });
        return this.graph;
    }

    getGraph() {
        if (!this.graph) return this.buildGraph();
        return this.graph;
    }
}