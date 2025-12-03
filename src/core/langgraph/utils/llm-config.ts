export const getLLMConfig = () => {
    const modelId = process.env.LLM || "gpt-4o-mini";
    const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;

    return { modelId, apiKey };
}