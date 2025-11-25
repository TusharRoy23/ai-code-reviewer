import { createAgent } from "langchain";
import { z } from "zod";

interface AgentOptions {
  name: string;
  model?: string;
  systemPrompt: string;
  tools?: any[];
}

const IssueSchema = z.object({
  type: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  recommendation: z.string(),
  lineStart: z.number(),
  lineEnd: z.number(),
});

const ReviewSchema = z.object({
  issues: z.array(IssueSchema),
});

export function makeAgent({
  name,
  model = "gpt-4o-mini",
  systemPrompt,
  tools = [],
}: AgentOptions) {
  const prompt = `${systemPrompt}
  You are reviewing a GIT DIFF.
  Rules:
  1. Review ONLY the code that explicitly visible in the GIT DIFF.
  2. Do NOT assume missing code, tests, or missing context.
  3. Return output as JSON and if no issue, return empty array.
  4. Keep "description" and "recommendation" from output schema short and direct.
  `.trim();

  return createAgent({
    name,
    model,
    tools,
    systemPrompt: prompt,
    responseFormat: ReviewSchema
  });
}

