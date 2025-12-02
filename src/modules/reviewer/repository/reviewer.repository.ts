import { inject, injectable } from "inversify";
import { v4 as uuidv4 } from "uuid";
import type { IReviewerRepository } from "../interface/IReviewer.repository.ts";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";
import { TYPES } from "../../../config/types.ts";
import type { IGraphBuilder } from "../../../core/langgraph/interface/IGraphBuilder.ts";
import type { FinalizeReview } from "../../../core/langgraph/utils/types.ts";

@injectable()
export class ReviewerRepository implements IReviewerRepository {
    private graph: any;
    constructor(
        @inject(TYPES.IGraphBuilder) private readonly codeReviewerBuilder: IGraphBuilder
    ) {
        this.graph = this.codeReviewerBuilder.getGraph();
    }

    async requestForReview(payload: ReviewPayloadType): Promise<FinalizeReview> {
        try {
            const result = await this.graph.invoke({
                rawInput: payload.code
            }, { configurable: { thread_id: uuidv4() } });
            const data = result.finalReview;
            return data;
        } catch (error) {
            throw error;
        }
    }
}