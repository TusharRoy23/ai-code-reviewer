import { inject, injectable } from "inversify";
import type { IReviewerService } from "../interface/IReviewer.service.ts";
import { TYPES } from "../../../config/types.ts";
import type { IReviewerRepository } from "../interface/IReviewer.repository.ts";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";
import type { FinalizeReview } from "../../../core/langgraph/utils/types.ts";
import type { ConversationPayloadType } from "../dto/conversation-payload.dto.ts";

@injectable()
export class ReviewerService implements IReviewerService {

    constructor(
        @inject(TYPES.IReviewerRepository) private readonly reviewerRepository: IReviewerRepository
    ) { }

    requestForReview(payload: ReviewPayloadType): Promise<FinalizeReview> {
        return this.reviewerRepository.requestForReview(payload);
    }

    generateThreadConversation(payload: ConversationPayloadType): Promise<string> {
        return this.reviewerRepository.generateThreadConversation(payload);
    }
}