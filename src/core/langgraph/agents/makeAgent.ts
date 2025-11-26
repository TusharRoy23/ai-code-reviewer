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
  let projectInfo = '';
  if (process.env.LANGUAGES) {
    projectInfo += `LANGUAGE: ${process.env.LANGUAGES}\n`
  }
  if (process.env.FRAMEWORKS) {
    projectInfo += `FRAMEWORKS: ${process.env.FRAMEWORKS}\n`
  }
  if (process.env.LIBRARIES) {
    projectInfo += `LIBRARIES: ${process.env.LIBRARIES}\n`
  }
  if (process.env.PROJECT_TYPE) {
    projectInfo += `PROJECT TYPE: ${process.env.PROJECT_TYPE}\n`
  }
  if (projectInfo != '') {
    projectInfo = `Project Info: \n${projectInfo}`
  }

  const prompt = `${systemPrompt}
  You are reviewing a GIT DIFF.
  Rules:
  1. Review ONLY the code that explicitly visible in the GIT DIFF.
  2. Do NOT assume missing code, tests, or missing context.
  3. Return output as JSON and if no issue, return empty array.
  4. Keep "description" and "recommendation" from output schema short and direct.\n
  ${projectInfo}
  `.trim();
  console.log('prompt: ', prompt);

  return createAgent({
    name,
    model,
    tools,
    systemPrompt: prompt,
    responseFormat: ReviewSchema
  });
}

