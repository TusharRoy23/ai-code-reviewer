import { inject } from "inversify";
import type { Request, Response } from "express";
import { TYPES } from "../../../config/types.ts";
import type { IReviewerService } from "../interface/IReviewer.service.ts";
import { controller, httpGet, httpPost, requestBody } from "inversify-express-utils";
import type { ReviewPayloadType } from "../dto/review-payload.dto.ts";
import { VerifyGitHubOIDCMiddleware } from "../../../middleware/github-oidc.middleware.ts";

@controller("/review")
export class ReviewerController {
    constructor(
        @inject(TYPES.IReviewerService) private readonly reviewerService: IReviewerService
    ) { }

    @httpPost("/", VerifyGitHubOIDCMiddleware)
    async performCodeReview(
        @requestBody() payload: ReviewPayloadType, req: Request, res: Response
    ) {
        // const githubContext = req.github;

        // console.log(`Starting review for ${githubContext?.repository}`);
        // console.log(`   SHA: ${githubContext?.sha}`);
        // console.log(`   Actor: ${githubContext?.actor}`);
        const result = await this.reviewerService.requestForReview(payload);
        return res.status(201).json({ data: result });
    }

    @httpGet("/health")
    async healthCheckup(req: Request, res: Response) {
        return res.status(200).json({ data: 'I am Good' })
    }
}