import type { Review } from "../../../core/langgraph/states/state.ts";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";

export interface IReviewerService {
    requestForReview(payload: ReviewPayloadType): Promise<Review[]>;
}