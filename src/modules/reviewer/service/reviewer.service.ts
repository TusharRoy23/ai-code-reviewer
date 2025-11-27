import { inject, injectable } from "inversify";
import type { IReviewerService } from "../interface/IReviewer.service.ts";
import { TYPES } from "../../../config/types.ts";
import type { IReviewerRepository } from "../interface/IReviewer.repository.ts";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";

@injectable()
export class ReviewerService implements IReviewerService {

    constructor(
        @inject(TYPES.IReviewerRepository) private readonly reviewerRepository: IReviewerRepository
    ) { }

    requestForReview(payload: ReviewPayloadType): Promise<any> {
        return this.reviewerRepository.requestForReview(payload);
    }
}