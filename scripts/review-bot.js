import { readFileSync } from "fs";
import axios from "axios";
// import { codeReviewGraph } from "../dist/core/langgraph/graph.js";

const API_BASE_URL = `http://localhost:8000`;
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  async (config) => config,
  (error) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

async function main() {
  const diffRaw = readFileSync(process.argv[2] || "pr.diff", "utf-8").trim();
  if (!diffRaw) {
    console.log("No changes to review. LGTM!");
    return;
  }

  // Make sure the diff is JSON safe
  const diff = JSON.stringify(diffRaw);

  // remove outer quotes so LangGraph receives raw text but escaped
  const escapedDiff = JSON.parse(diff);

  const result = await apiClient.post(`/review`, { code: escapedDiff });

  // const result = await codeReviewGraph.invoke({ rawInput: escapedDiff });
  console.log(JSON.stringify(result.reviews || []));
}

main().catch(err => {
  console.error("Review failed:", err.message);
  process.exit(1);
});