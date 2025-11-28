import { readFileSync } from "fs";
import axios from "axios";
import * as core from "@actions/core";

const API_BASE_URL = `https://ai-code-reviewer-restless-violet-7974.fly.dev`;

// Function to get GitHub OIDC token
async function getGitHubOIDCToken() {
  try {
    // Request OIDC token from GitHub Actions
    // The audience must match what your backend expects
    const token = await core.getIDToken(API_BASE_URL);

    if (!token) {
      throw new Error("Failed to obtain GitHub OIDC token");
    }

    return token;
  } catch (error) {
    console.error("❌ Error obtaining GitHub OIDC token:", error.message);
    throw error;
  }
}

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  },
  withCredentials: true,
  // timeout: 30000
});

// Request interceptor: Inject OIDC token into every request
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const oidcToken = await getGitHubOIDCToken();

      // Add token to Authorization header
      config.headers["Authorization"] = `Bearer ${oidcToken}`;

      return config;
    } catch (error) {
      console.error("❌ Failed to add OIDC token to request:", error.message);
      throw error;
    }
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("❌ Unauthorized: Invalid or expired OIDC token");
    } else if (error.response?.status === 403) {
      console.error("❌ Forbidden: Not allowed to access this resource");
    } else if (error.response?.status === 503) {
      console.error("❌ Service Unavailable: Backend service temporarily down");
    }
    return Promise.reject(error);
  }
);

async function main() {
  try {
    const diffPath = process.argv[2] || "pr.diff";
    const diffRaw = readFileSync(diffPath, "utf-8").trim();

    if (!diffRaw) {
      return;
    }

    // Make sure the diff is JSON safe
    const diff = JSON.stringify(diffRaw);

    // remove outer quotes so the backend receives raw text but escaped
    const escapedDiff = JSON.parse(diff);

    const result = await apiClient.post(`/review`, {
      code: escapedDiff
    });
    console.log(JSON.stringify(result.data?.data || []));

  } catch (error) {
    console.error("❌ Review failed:", error.response?.data || error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});