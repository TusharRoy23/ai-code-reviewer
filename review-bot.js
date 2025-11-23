// review-bot.js - Simple CLI that runs your existing LangGraph
import { readFileSync } from 'fs';
import { codeReviewGraph } from "./src/core/langgraph/graph" // adjust path if needed

async function main() {
  const diff = readFileSync(process.argv[2] || "pr.diff", "utf-8").trim();
  if (!diff) {
    console.log("No changes to review. LGTM!");
    return;
  }

  const result = await codeReviewGraph.invoke({ rawInput: diff });
  console.log(result.finalReview || "No issues found. Great job!");
}

main().catch(err => {
  console.error("Review failed:", err.message);
  process.exit(1);
});