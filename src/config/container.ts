import { Container } from "inversify";
import "../modules/index.controller.ts";
import type { IReviewerRepository } from "../modules/reviewer/interface/IReviewer.repository.ts";
import { TYPES } from "./types.ts";
import { ReviewerRepository } from "../modules/reviewer/repository/reviewer.repository.ts";
import type { IReviewerService } from "../modules/reviewer/interface/IReviewer.service.ts";
import { ReviewerService } from "../modules/reviewer/service/reviewer.service.ts";
import { CodeReviewerGraph } from "../core/langgraph/graph.ts";
import type { IReviewerNodes } from "../core/langgraph/interface/IReviewer.nodes.ts";
import { ReviewerNodes } from "../core/langgraph/nodes/reviewer.node.ts";
import type { IGraphBuilder } from "../core/langgraph/interface/IGraphBuilder.ts";
import { VerifyGitHubOIDCMiddleware } from "../middleware/github-oidc.middleware.ts";

const container = new Container({ defaultScope: "Singleton" });
/* Reviewer */
container.bind<IReviewerRepository>(TYPES.IReviewerRepository).to(ReviewerRepository);
container.bind<IReviewerService>(TYPES.IReviewerService).to(ReviewerService);

/* LangGraph */
container.bind<IGraphBuilder>(TYPES.IGraphBuilder).to(CodeReviewerGraph);
container.bind<IReviewerNodes>(TYPES.IReviewerNodes).to(ReviewerNodes);

/* Middleware */
container.bind<VerifyGitHubOIDCMiddleware>(VerifyGitHubOIDCMiddleware).toSelf();

export default container;