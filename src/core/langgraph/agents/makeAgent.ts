// agents/makeAgent.ts
import { createAgent } from "langchain";
import { z } from "zod";

interface AgentOptions {
  name: string;
  model?: string;
  systemPrompt: string;
  tools?: any[];
  responseSchema?: z.ZodType<any>;
}

const IssueSchema = z.object({
  type: z.string(),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
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
  priority: z.enum(["critical", "high", "normal", "low"]),
  reasoning: z.string(),
});

export function makeAgent({
  name,
  model = "gpt-4o-mini",
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

  // Use custom schema if provided (for coordinator), otherwise use default ReviewSchema
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