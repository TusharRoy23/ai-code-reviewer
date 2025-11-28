import { inject } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../../config/types.ts";
import type { IReviewerService } from "../interface/IReviewer.service.ts";
import { controller, httpPost, requestBody } from "inversify-express-utils";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";
import { VerifyGitHubOIDCMiddleware } from "../../../middleware/github-oidc.middleware.ts";

@controller("/review", VerifyGitHubOIDCMiddleware)
export class ReviewerController {
    constructor(
        @inject(TYPES.IReviewerService) private readonly reviewerService: IReviewerService
    ) { }

    @httpPost("/")
    async performCodeReview(
        @requestBody() payload: ReviewPayloadType, req: Request, res: Response
    ) {
        const result = await this.reviewerService.requestForReview(payload);
        return res.status(201).json({ data: result });
    }
}