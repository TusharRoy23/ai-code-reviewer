// review-bot.js - Simple CLI that runs your existing LangGraph
import { readFileSync } from 'fs';
import { codeReviewGraph } from "./dist/core/langgraph/graph.js" // adjust path if needed

async function main() {
  const diffRaw = readFileSync(process.argv[2] || "pr.diff", "utf-8").trim();
  if (!diff) {
    console.log("No changes to review. LGTM!");
    return;
  }

  // 🔥 Make sure the diff is JSON safe
  const diff = JSON.stringify(diffRaw);   // <-- THIS FIXES YOUR PROBLEM

  // OPTIONAL: remove outer quotes so LangGraph receives raw text but escaped
  const escapedDiff = JSON.parse(diff);

  const result = await codeReviewGraph.invoke({ rawInput: diescapedDiffff });
  console.log(result.finalReview || "No issues found. Great job!");
}

main().catch(err => {
  console.error("Review failed:", err.message);
  process.exit(1);
});