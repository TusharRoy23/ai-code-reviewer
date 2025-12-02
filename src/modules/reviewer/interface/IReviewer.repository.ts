import type { FinalizeReview } from "../../../core/langgraph/utils/types.ts";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";

export interface IReviewerRepository {
    requestForReview(payload: ReviewPayloadType): Promise<FinalizeReview>;
}