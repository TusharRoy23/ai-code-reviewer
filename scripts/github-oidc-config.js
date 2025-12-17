import * as core from "@actions/core";

const API_BASE_URL = process.env.API_BASE_URL || "https://ai-code-reviewer-restless-violet-7974.fly.dev";

/**
 * Get GitHub OIDC token for authentication
 */
async function getGitHubOIDCToken() {
    const originalLog = console.log;
    const originalError = console.error;

    try {
        console.log = () => { };
        console.error = () => { };

        const token = await core.getIDToken(API_BASE_URL);

        console.log = originalLog;
        console.error = originalError;

        if (!token) {
            throw new Error("GitHub Actions did not return a token");
        }

        return token;

    } catch (error) {
        console.log = originalLog;
        console.error = originalError;
        throw error;
    }
}

export default getGitHubOIDCToken;