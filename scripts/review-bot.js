import { readFileSync } from "fs";
import axios from "axios";
import * as core from "@actions/core";

const API_BASE_URL = `https://ai-code-reviewer-restless-violet-7974.fly.dev`;

// Suppress GitHub Actions core debug output to avoid polluting stdout
// Redirect console methods to stderr only during token acquisition
const originalLog = console.log;
const originalError = console.error;

const debugLog = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    writeFileSync("review-bot.debug.log", logMessage, { flag: "a" });
  } catch (error) {
    // Silently fail if we can't write debug log
  }
};

// Function to get GitHub OIDC token
async function getGitHubOIDCToken() {
  try {
    console.log = () => { };
    console.error = () => { };
    // Request OIDC token from GitHub Actions
    // The audience must match what your backend expects
    const token = await core.getIDToken(API_BASE_URL);
    // Restore console methods
    console.log = originalLog;
    console.error = originalError;

    if (!token) {
      throw new Error("Failed to obtain GitHub OIDC token");
    }

    return token;
  } catch (error) {
    debugLog("❌ Error obtaining GitHub OIDC token:", error.message);
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
      debugLog("❌ Failed to add OIDC token to request:", error.message);
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
      debugLog("❌ Unauthorized: Invalid or expired OIDC token");
    } else if (error.response?.status === 403) {
      debugLog("❌ Forbidden: Not allowed to access this resource");
    } else if (error.response?.status === 503) {
      debugLog("❌ Service Unavailable: Backend service temporarily down");
    }
    return Promise.reject(error);
  }
);

async function main() {
  try {
    const diffPath = process.argv[2] || "pr.diff";
    const diffRaw = readFileSync(diffPath, "utf-8").trim();

    if (!diffRaw) {
      console.log(JSON.stringify([]));
      return;
    }

    // Make sure the diff is JSON safe
    const diff = JSON.stringify(diffRaw);

    // remove outer quotes so the backend receives raw text but escaped
    const escapedDiff = JSON.parse(diff);

    const result = await apiClient.post(`/review`, {
      code: escapedDiff
    });
    debugLog("✅ AI review completed successfully");

    // Validate response data
    const responseData = result.data?.data;

    // If response is empty, output empty array
    if (!responseData) {
      debugLog("⚠️  API returned no data, outputting empty array");
      console.log(JSON.stringify([]));
      return;
    }

    // ONLY output the data - no other logs
    // This ensures review.json contains pure JSON
    if (typeof responseData === 'string') {
      // If backend returns a string, try to parse it
      try {
        const parsed = JSON.parse(responseData);
        console.log(JSON.stringify(parsed));
      } catch {
        // If parsing fails, wrap it as an error
        console.log(JSON.stringify({ error: responseData }));
      }
    } else {
      // Direct object/array output
      console.log(JSON.stringify(responseData));
    }

  } catch (error) {
    debugLog("❌ Review failed:", error.response?.data || error.message);
    // Output error as JSON so downstream scripts can parse it
    console.log(JSON.stringify({
      error: error.response?.data?.error || error.message,
      code: error.response?.data?.code || "UNKNOWN_ERROR"
    }));
    process.exit(1);
  }
}

main().catch(err => {
  debugLog("❌ Fatal error:", err.message);
  console.log(JSON.stringify({
    error: err.message,
    code: "FATAL_ERROR"
  }));
  process.exit(1);
});