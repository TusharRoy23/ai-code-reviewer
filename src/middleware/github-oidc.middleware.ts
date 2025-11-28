import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import { BaseMiddleware } from "inversify-express-utils";

interface GitHubOIDCPayload extends jwt.JwtPayload {
    repository: string;
    repository_id: number;
    repository_owner: string;
    repository_owner_id: number;
    actor: string;
    actor_id: number;
    ref: string;
    sha: string;
    workflow_ref: string;
    job_id: string;
    run_id: string;
    run_attempt: number;
    event_name: string;
    environment?: string;
}

interface GitHubContextType {
    repository: string;
    repositoryId: number;
    repositoryOwner: string;
    actor: string;
    ref: string;
    sha: string;
    workflowRef: string;
    jobId: string;
    runId: string;
    eventName: string;
}

// Extend Express Request type to include github context
declare global {
    namespace Express {
        interface Request {
            github?: GitHubContextType;
        }
    }
}

const GITHUB_OIDC_CONFIG = {
    issuer: "https://token.actions.githubusercontent.com",
    jwksUri: "https://token.actions.githubusercontent.com/.well-known/jwks",
    audience: process.env.OIDC_AUDIENCE || "https://api.github.com"
};

let cachedJWKS: any = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

async function fetchGitHubJWKS() {
    const now = Date.now();

    // Return cached JWKS if still valid
    if (cachedJWKS && now - jwksCacheTime < JWKS_CACHE_TTL) {
        return cachedJWKS;
    }

    try {
        const response = await axios.get(GITHUB_OIDC_CONFIG.jwksUri, {
            timeout: 5000
        });
        cachedJWKS = response.data;
        jwksCacheTime = now;
        return cachedJWKS;
    } catch (error: any) {
        console.error("Failed to fetch GitHub JWKS:", error.message);
        throw new Error("Failed to fetch GitHub JWKS");
    }
}

function getSigningKey(kid: string, jwks: any): string {
    const signingKey = jwks.keys.find((key: any) => key.kid === kid);

    if (!signingKey) {
        throw new Error(`Unable to find signing key with kid: ${kid}`);
    }

    if (!signingKey.x5c || signingKey.x5c.length === 0) {
        throw new Error("No certificate chain found in signing key");
    }

    return `-----BEGIN CERTIFICATE-----\n${signingKey.x5c[0]}\n-----END CERTIFICATE-----`;
}

const getAuthorizationHeader = (req: Request, res: Response): string | null => {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        console.warn("Missing Authorization header");
        res.status(401).json({
            error: "Missing Authorization header",
            code: "AUTH_HEADER_MISSING"
        });
        return null;
    }

    if (!authHeader.startsWith("Bearer ")) {
        console.warn("Invalid Authorization header format");
        res.status(401).json({
            error: "Invalid Authorization header format. Expected: Bearer <token>",
            code: "INVALID_AUTH_FORMAT"
        });
        return null;
    }
    return authHeader;
}

const getDecodedToken = (res: Response, token: string): any | null => {
    try {
        // Decode the header and payload WITHOUT verification
        const decoded: any = jwt.decode(token, { complete: true });

        if (!decoded) {
            console.warn("Failed to decode token - token appears to be malformed");
            res.status(401).json({
                error: "Invalid token format",
                code: "DECODE_ERROR"
            });
            return null;
        }

        // Check if kid exists in header
        if (!decoded.header?.kid) {
            console.warn("Token header missing kid (key ID)");
            res.status(401).json({
                error: "Invalid token: missing key ID in header",
                code: "MISSING_KID"
            });
            return null;
        }

        return decoded.payload;

    } catch (error: any) {
        console.error("Token decode error:", error.message);
        res.status(401).json({
            error: "Invalid token format",
            code: "DECODE_ERROR"
        });
        return null;
    }
}

const getGithubJWKS = async (res: Response): Promise<any> => {
    try {
        return await fetchGitHubJWKS();
    } catch (error: any) {
        console.error("JWKS fetch failed:", error.message);
        res.status(503).json({
            error: "Service temporarily unavailable",
            code: "JWKS_FETCH_ERROR"
        });
        return null;
    }
}

const fetchSigningCertificate = (res: Response, token: string, jwks: any): string | null => {
    try {
        // Decode to get kid from header
        const decoded: any = jwt.decode(token, { complete: true });
        const kid = decoded?.header?.kid;

        if (!kid) {
            console.warn("Could not extract kid from token header");
            res.status(401).json({
                error: "Invalid token: signing key ID not found",
                code: "SIGNING_KEY_ERROR"
            });
            return null;
        }

        return getSigningKey(kid, jwks);
    } catch (error: any) {
        console.error("Signing certificate fetch failed:", error.message);
        res.status(401).json({
            error: "Invalid token: signing key not found",
            code: "SIGNING_KEY_ERROR"
        });
        return null;
    }
}

const getVerifyToken = (res: Response, token: string, signingKey: string): GitHubOIDCPayload | null => {
    try {
        const verified = jwt.verify(token, signingKey, {
            algorithms: ["RS256"],
            issuer: GITHUB_OIDC_CONFIG.issuer,
            audience: GITHUB_OIDC_CONFIG.audience
        }) as GitHubOIDCPayload;

        return verified;

    } catch (error: any) {
        console.error("Token verification error:", error.name, "-", error.message);

        if (error.name === "TokenExpiredError") {
            res.status(401).json({
                error: "Token expired",
                code: "TOKEN_EXPIRED"
            });
            return null;
        }

        if (error.name === "JsonWebTokenError") {
            res.status(401).json({
                error: "Token verification failed: " + error.message,
                code: "VERIFICATION_FAILED"
            });
            return null;
        }

        if (error.name === "NotBeforeError") {
            res.status(401).json({
                error: "Token not yet valid",
                code: "NOT_BEFORE_ERROR"
            });
            return null;
        }

        res.status(401).json({
            error: "Authentication failed: " + error.message,
            code: "AUTH_FAILED"
        });
        return null;
    }
}

export class VerifyGitHubOIDCMiddleware extends BaseMiddleware {
    async handler(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            if (process.env.NODE_ENV === 'development') {
                next();
                return;
            }

            // Step 1: Extract Authorization header
            const authHeader = getAuthorizationHeader(req, res);
            if (!authHeader) return;

            const token = authHeader.substring(7);

            // Step 2: Decode token header without verification to extract kid
            const decoded = getDecodedToken(res, token);
            if (!decoded) return;

            // Step 3: Fetch GitHub JWKS (cached)
            const jwks = await getGithubJWKS(res);
            if (!jwks) return;

            // Step 4: Get the signing certificate
            const signingKey = fetchSigningCertificate(res, token, jwks);
            if (!signingKey) return;

            // Step 5: Verify the token with full validation
            const verified = getVerifyToken(res, token, signingKey);
            if (!verified) return;

            // Step 6: Attach GitHub context to request
            req.github = {
                repository: verified.repository,
                repositoryId: verified.repository_id,
                repositoryOwner: verified.repository_owner,
                actor: verified.actor,
                ref: verified.ref,
                sha: verified.sha,
                workflowRef: verified.workflow_ref,
                jobId: verified.job_id,
                runId: verified.run_id,
                eventName: verified.event_name
            };

            // Proceed to next middleware/controller
            next();

        } catch (error: any) {
            console.error("Unexpected error in OIDC middleware:", error.message);
            res.status(500).json({
                error: "Internal server error",
                code: "INTERNAL_ERROR"
            });
            return;
        }
    }
}