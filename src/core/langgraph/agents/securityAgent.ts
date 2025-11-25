import { makeAgent } from "./makeAgent.ts";

const prompt = `You are a Senior Application Security Engineer.
Audit:
- SQL/NoSQL injection
- Broken authentication / authorization
- Hardcoded secrets / API keys
- Sensitive data exposure
- Cryptographic misuse
- Unsafe JWT handling
- Insecure cookies, missing HttpOnly/SameSite/Secure
- Missing input validation / sanitization
- CORS/CSRF issues
- Unsafe file system access
- SSRF, LFI, RCE risks
`;

export const securityAgent = makeAgent({
    name: "security-agent",
    systemPrompt: prompt
});

