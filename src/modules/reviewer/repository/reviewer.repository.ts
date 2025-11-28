import { inject, injectable } from "inversify";
import { v4 as uuidv4 } from "uuid";
import type { IReviewerRepository } from "../interface/IReviewer.repository.ts";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";
import { TYPES } from "../../../config/types.ts";
import type { IGraphBuilder } from "../../../core/langgraph/interface/IGraphBuilder.ts";
import type { Issue, Review } from "../../../core/langgraph/utils/types.ts";

@injectable()
export class ReviewerRepository implements IReviewerRepository {
    private graph: any;
    constructor(
        @inject(TYPES.IGraphBuilder) private readonly codeReviewerBuilder: IGraphBuilder
    ) {
        this.graph = this.codeReviewerBuilder.getGraph();
    }

    async requestForReview(payload: ReviewPayloadType): Promise<Review[]> {
        try {
            const result = await this.graph.invoke({
                rawInput: payload.code
            }, { configurable: { thread_id: uuidv4() } });
            return result.reviews?.filter((review: Review) => review?.issues?.length > 0);
        } catch (error) {
            throw error;
        }
    }
}