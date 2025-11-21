import { createAgent } from "langchain";

interface AgentOptions {
    name: string;
    model?: string;
    systemPrompt: string;
    tools?: any[];
}

export function makeAgent({
    name,
    model = "gpt-4o-mini",
    systemPrompt,
    tools = [],
}: AgentOptions) {
    const prompt = `
You are a senior software engineering analysis agent.

You are reviewing a GIT DIFF. The code is partial and may not include full context.

Rules:
1. Review ONLY the code visible in the diff.
2. Do NOT assume missing code, missing tests, or missing context.
3. Report issues only if they are explicitly visible in the diff.
4. Return exactly one JSON object with the following shape:

{
  "issues": [
    {
      "type": "string",
      "description": "string",
      "severity": "low | medium | high | critical",
      "recommendation": "string",
      "lineStart": number,
      "lineEnd": number
    }
  ]
}

5. If there are no issues, return {"issues": []}.
6. Keep descriptions and recommendations short and direct.
7. Never output anything outside the JSON.
8. Your focus areas:
${systemPrompt}
    `.trim();

    return createAgent({
        name,
        model,
        tools,
        systemPrompt: prompt
    });
}

