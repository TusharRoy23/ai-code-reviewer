import { readFileSync } from "fs";
import { codeReviewGraph } from "../dist/core/langgraph/graph.js";

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

  const result = await codeReviewGraph.invoke({ rawInput: escapedDiff });
  console.log(JSON.stringify(result.reviews || []));
}

main().catch(err => {
  console.error("Review failed:", err.message);
  process.exit(1);
});