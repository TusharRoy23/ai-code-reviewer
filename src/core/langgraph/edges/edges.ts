import { Send } from "@langchain/langgraph";
import type { ReviewState } from "../states/state.ts";

/*
    DOC URL: https://docs.langchain.com/oss/javascript/langgraph/graph-api#send
    Why Send: To prepare dynamic nodes. In the graph it will be like this - 
    addEdge("routeToCoordinator", ["coordinateReview", coordinateReview], coordinateReview, ....)
    /? This example just to understand the visualization
*/

const routeToCoordinator = (state: typeof ReviewState.State) => {
    return state.chunks.map((chunk) =>
        new Send("coordinateReview", { chunkData: chunk })
    );
};

// Route each file + plan to review
const routeToReview = (state: typeof ReviewState.State) => {
    // Match chunks with their plans
    return state.chunks.map((chunk) => {
        const plan = state.agentPlans.find(p => p.filename === chunk.filename);
        return new Send("reviewWithAgents", {
            chunkData: chunk,
            plan: plan || { filename: chunk.filename, agents: [], priority: 'normal', reasoning: 'No plan' }
        });
    });
};

export const edges = {
    routeToCoordinator,
    routeToReview
};