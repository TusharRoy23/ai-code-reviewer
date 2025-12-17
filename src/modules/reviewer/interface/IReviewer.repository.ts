import type { FinalizeReview } from "../../../core/langgraph/utils/types.ts";
import type { ConversationPayloadType } from "../dto/conversation-payload.dto.ts";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";

export interface IReviewerRepository {
    requestForReview(payload: ReviewPayloadType): Promise<FinalizeReview>;
    generateThreadConversation(payload: ConversationPayloadType): Promise<string>;
}