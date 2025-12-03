import { createAgent, initChatModel } from "langchain";
import { z } from "zod";
import { getLLMConfig } from "../utils/llm-config.ts";
import { Priority, Severity } from "../utils/types.ts";

interface AgentOptions {
  name: string;
  systemPrompt: string;
  tools?: any[];
  responseSchema?: z.ZodType<any>;
}

const IssueSchema = z.object({
  type: z.string(),
  description: z.string(),
  severity: z.enum(Severity),
  recommendation: z.string(),
  lineStart: z.number(),
  lineEnd: z.number(),
  confidence: z.enum(["low", "medium", "high"]),
  category: z.string(),
});

const ReviewSchema = z.object({
  issues: z.array(IssueSchema),
});

// For coordinator
const AgentPlanSchema = z.object({
  agents: z.array(z.string()),
  priority: z.enum(Priority),
  reasoning: z.string(),
});

const { modelId, apiKey } = getLLMConfig();
const model = await initChatModel(modelId, {
  apiKey: apiKey,
});

export function makeAgent({
  name,
  systemPrompt,
  tools = [],
  responseSchema,
}: AgentOptions) {
  let projectInfo = '';
  if (process.env.LANGUAGES) projectInfo += `Languages: ${process.env.LANGUAGES}\n`;
  if (process.env.FRAMEWORKS) projectInfo += `Frameworks: ${process.env.FRAMEWORKS}\n`;
  if (process.env.LIBRARIES) projectInfo += `Libraries: ${process.env.LIBRARIES}\n`;
  if (process.env.PROJECT_TYPE) projectInfo += `Project Type: ${process.env.PROJECT_TYPE}\n`;

  if (projectInfo) {
    projectInfo = `\n**Project Context:**\n${projectInfo}`;
  }

  const finalPrompt = `${systemPrompt}${projectInfo}

**Output Rules:**
1. Return valid JSON only
2. Be specific with line numbers
3. Keep descriptions concise but actionable
4. If no issues found, return {"issues": []}
`.trim();

  // Use custom schema if provided (for coordinator agent), otherwise use default ReviewSchema
  const schema = responseSchema || ReviewSchema;

  return createAgent({
    name,
    model,
    tools,
    systemPrompt: finalPrompt,
    responseFormat: schema
  });
}

// Export schemas for use elsewhere
export { ReviewSchema, AgentPlanSchema };