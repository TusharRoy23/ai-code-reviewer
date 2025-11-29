/**
 * AI Code Review Bot
 * 
 * Reads a git diff file, sends it to the AI review API with GitHub OIDC authentication,
 * and outputs the review results as JSON.
 * 
 * Usage: node review-bot.js <path-to-diff-file>
 * Output: JSON array of review items to stdout
 * Debug: All debug logs written to review-bot.debug.log
 */

import { readFileSync, writeFileSync } from "fs";
import axios from "axios";
import * as core from "@actions/core";

// ============================================
// CONFIGURATION
// ============================================

const API_BASE_URL = process.env.API_BASE_URL || "https://ai-code-reviewer-restless-violet-7974.fly.dev";
const DEBUG_LOG_FILE = "review-bot.debug.log";

// ============================================
// UTILITIES
// ============================================

/**
 * Write debug messages to a separate log file
 * Prevents debug output from polluting stdout (which must be pure JSON)
 */
const debugLog = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  try {
    writeFileSync(DEBUG_LOG_FILE, logMessage, { flag: "a" });
  } catch (error) {
    // Silently fail - don't break the script if we can't write debug log
  }
};

/**
 * Output structured error as JSON to stdout
 */
const outputError = (error, code = "UNKNOWN_ERROR") => {
  console.log(JSON.stringify({
    error: typeof error === 'string' ? error : error.message,
    code: code
  }));
};

/**
 * Output successful review data as JSON to stdout
 */
const outputSuccess = (data) => {
  if (!data) {
    console.log(JSON.stringify([]));
    return;
  }

  // Handle different data formats
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed));
    } catch {
      outputError(data, "INVALID_JSON");
    }
  } else {
    // Direct object/array output
    console.log(JSON.stringify(data));
  }
};

// ============================================
// GITHUB OIDC TOKEN HANDLING
// ============================================

/**
 * Get GitHub OIDC token from GitHub Actions environment
 * 
 * This token is automatically provided by GitHub Actions when:
 * - Workflow has `permissions: { id-token: write }`
 * - The token proves the request comes from GitHub Actions
 */
const getGitHubOIDCToken = async () => {
  const originalLog = console.log;
  const originalError = console.error;

  try {
    // Suppress GitHub Actions debug output during token acquisition
    // @actions/core prints debug messages that would pollute stdout
    console.log = () => { };
    console.error = () => { };

    debugLog("🔐 Requesting GitHub OIDC token from GitHub Actions...");

    const token = await core.getIDToken(API_BASE_URL);

    // Restore console methods
    console.log = originalLog;
    console.error = originalError;

    if (!token) {
      throw new Error("GitHub Actions did not return a token");
    }

    debugLog("✅ Successfully obtained GitHub OIDC token");
    return token;

  } catch (error) {
    // Restore console methods even on error
    console.log = originalLog;
    console.error = originalError;

    debugLog(`❌ Failed to get GitHub OIDC token: ${error.message}`);
    throw error;
  }
};

// ============================================
// API CLIENT SETUP
// ============================================

/**
 * Create axios HTTP client with OIDC authentication
 * 
 * The request interceptor automatically:
 * - Gets a fresh GitHub OIDC token
 * - Adds it to the Authorization header
 * - Sends it with every request to the backend
 */
const createAuthenticatedApiClient = () => {
  const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json"
    },
    withCredentials: true
  });

  // Request interceptor: Add OIDC token to every request
  apiClient.interceptors.request.use(
    async (config) => {
      try {
        const oidcToken = await getGitHubOIDCToken();
        config.headers["Authorization"] = `Bearer ${oidcToken}`;
        debugLog("📤 Authorization header added to request");
        return config;
      } catch (error) {
        debugLog(`❌ Failed to add authentication: ${error.message}`);
        throw error;
      }
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor: Handle specific error cases
  apiClient.interceptors.response.use(
    (response) => {
      debugLog(`✅ API response received (status: ${response.status})`);
      return response;
    },
    (error) => {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;

      if (status === 401) {
        debugLog(`❌ Authentication failed (401): Invalid or expired OIDC token`);
      } else if (status === 403) {
        debugLog(`❌ Permission denied (403): Not allowed to access resource`);
      } else if (status === 503) {
        debugLog(`❌ Service unavailable (503): Backend is down`);
      } else {
        debugLog(`❌ API error (${status}): ${message}`);
      }

      return Promise.reject(error);
    }
  );

  return apiClient;
};

// ============================================
// DIFF FILE HANDLING
// ============================================

/**
 * Read and parse the git diff file
 * Ensures the diff content is JSON-safe for transmission
 */
const readDiffFile = (filePath) => {
  try {
    debugLog(`📄 Reading diff file: ${filePath}`);
    const rawDiff = readFileSync(filePath, "utf-8").trim();

    if (!rawDiff) {
      debugLog("⚠️  Diff file is empty");
      return null;
    }

    debugLog(`✅ Diff file read successfully (${rawDiff.length} bytes)`);

    // Ensure diff is JSON-safe by stringifying and parsing
    // This escapes special characters and handles edge cases
    const jsonSafeDiff = JSON.parse(JSON.stringify(rawDiff));

    return jsonSafeDiff;

  } catch (error) {
    debugLog(`❌ Failed to read diff file: ${error.message}`);
    throw error;
  }
};

// ============================================
// API COMMUNICATION
// ============================================

/**
 * Send code diff to the AI review backend
 * 
 * Request includes:
 * - code: The git diff to review
 * - OIDC token: Automatically added by interceptor
 * 
 * Response contains:
 * - data: Array of review items with issues and recommendations
 */
const sendDiffForReview = async (apiClient, diffContent) => {
  try {
    debugLog("📤 Sending diff to AI review API...");

    const response = await apiClient.post("/review", {
      code: diffContent
    });

    debugLog("✅ Received response from API");
    return response.data;

  } catch (error) {
    debugLog(`❌ API request failed: ${error.message}`);
    throw error;
  }
};

// ============================================
// RESPONSE PROCESSING
// ============================================

/**
 * Extract review data from API response
 * 
 * The API response structure is:
 * {
 *   data: [ review items ]
 * }
 * 
 * We extract the inner 'data' array
 */
const extractReviewData = (apiResponse) => {
  if (!apiResponse) {
    debugLog("⚠️  API returned empty response");
    return null;
  }

  const reviewData = apiResponse.data;

  if (!reviewData) {
    debugLog("⚠️  API response has no 'data' field");
    return null;
  }

  debugLog(`✅ Extracted ${Array.isArray(reviewData) ? reviewData.length : "1"} review item(s)`);
  return reviewData;
};

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  try {
    debugLog("🚀 Starting AI Code Review Bot...");

    // Step 1: Read the diff file
    const diffFilePath = process.argv[2] || "pr.diff";
    const diffContent = readDiffFile(diffFilePath);

    if (!diffContent) {
      debugLog("ℹ️  No code changes to review, outputting empty array");
      outputSuccess([]);
      return;
    }

    // Step 2: Create authenticated API client
    debugLog("🔧 Setting up API client with OIDC authentication...");
    const apiClient = createAuthenticatedApiClient();

    // Step 3: Send diff to backend for review
    const apiResponse = await sendDiffForReview(apiClient, diffContent);

    // Step 4: Extract and validate review data
    const reviewData = extractReviewData(apiResponse);

    // Step 5: Output results as JSON
    debugLog("✅ Review completed successfully");
    outputSuccess(reviewData);

  } catch (error) {
    // Output error as JSON so downstream scripts can parse it
    debugLog(`❌ Fatal error in main: ${error.message}`);
    outputError(error.message, "REVIEW_FAILED");
    process.exit(1);
  }
}

// Handle unexpected errors
process.on('unhandledRejection', (error) => {
  debugLog(`❌ Unhandled promise rejection: ${error.message}`);
  outputError(error.message, "UNHANDLED_ERROR");
  process.exit(1);
});

// Run the script
main();