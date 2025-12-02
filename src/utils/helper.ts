import { SIMPLE_CHANGE_THRESHOLD, SKIP_PATTERNS } from "./filters.ts";
import { architectureAgent } from "../core/langgraph/agents/architectureAgent.ts";
import { idiomaticAgent } from "../core/langgraph/agents/idiomaticAgent.ts";
import { performanceAgent } from "../core/langgraph/agents/performanceAgent.ts";
import { readabilityAgent } from "../core/langgraph/agents/readabilityAgent.ts";
import { securityAgent } from "../core/langgraph/agents/securityAgent.ts";
import { testingAgent } from "../core/langgraph/agents/testingAgent.ts";
import { Agents } from "../core/langgraph/utils/types.ts";
import { bugsAgent } from "../core/langgraph/agents/bugAgent.ts";

export const reviewAgents = [
    { name: "security", agent: securityAgent },
    { name: "performance", agent: performanceAgent },
    { name: "testing", agent: testingAgent },
    { name: "readability", agent: readabilityAgent },
    { name: "idiomatic", agent: idiomaticAgent },
    { name: "architecture", agent: architectureAgent },
    { name: "bugs", agent: bugsAgent }
];

export const AGENT_MAP: Record<string, any> = {
    [Agents.SECURITY]: securityAgent,
    [Agents.PERFORMANCE]: performanceAgent,
    [Agents.ARCHITECTURE]: architectureAgent,
    [Agents.TESTING]: testingAgent,
    [Agents.READABILITY]: readabilityAgent,
    [Agents.IDIOMATIC]: idiomaticAgent,
    [Agents.BUGS]: bugsAgent
};

/**
 * Check if a file should be skipped
 */
export const shouldSkipFile = (filename: string): boolean => {
    return SKIP_PATTERNS.some(pattern => pattern.test(filename));
}

/**
 * Estimate token count (rough approximation: ~4 chars = 1 token)
 */
export const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
}

/**
 * Check if change is too simple to warrant AI review
 */
export const isSimpleChange = (content: string): boolean => {
    const lines = content.split('\n');
    const additions = lines.filter(l => l.startsWith('+')).length;
    const deletions = lines.filter(l => l.startsWith('-')).length;
    const totalChanges = additions + deletions;

    // Skip if very few changes
    if (totalChanges <= SIMPLE_CHANGE_THRESHOLD.MAX_LINES) {
        return true;
    }

    // Skip if only whitespace/formatting changes
    const meaningfulChanges = lines.filter(line => {
        if (!line.startsWith('+') && !line.startsWith('-')) return false;
        const cleaned = line.slice(1).trim();
        // Check if it's just whitespace, braces, or semicolons
        return cleaned.length > 0 && !/^[\s{}();,]+$/.test(cleaned);
    });

    if (meaningfulChanges.length === 0) {
        return true;
    }

    // Skip if only comments changed
    const onlyComments = meaningfulChanges.every(line => {
        const cleaned = line.slice(1).trim();
        return cleaned.startsWith('//') ||
            cleaned.startsWith('/*') ||
            cleaned.startsWith('*') ||
            cleaned.startsWith('#');
    });

    return onlyComments;
}

/**
 * Extract file type for context
 */
export const getFileType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
        'ts': 'TypeScript',
        'tsx': 'TypeScript',
        'js': 'JavaScript',
        'jsx': 'JavaScript',
        'py': 'Python',
        'java': 'Java',
        'go': 'Go',
        'rb': 'Ruby',
        'php': 'PHP',
        'rs': 'Rust',
        'cpp': 'C++',
        'cc': 'C++',
        'c': 'C',
        'cs': 'C#',
        'swift': 'Swift',
        'kt': 'Kotlin',
        'scala': 'Scala',
        'ex': 'Elixir',
        'exs': 'Elixir',
        'html': "HTML",
        'css': "CSS",
        'scss': "SCSS",
        'sql': "SQL",
        'sh': "Shell"
    };
    return typeMap[ext] || ext.toUpperCase();
}

/**
 * Calculate priority score for a file (1 to 10)
 * 1 = Lowest
 * 10 = Highest
 */
export const getFilePriority = (filename: string): number => {
    // Security-critical files
    if (/auth|security|password|token|crypto/i.test(filename)) return 10;

    // API/Backend files
    if (/api|controller|route|handler|service/i.test(filename)) return 8;

    // Core business logic
    if (/core|business|logic|model/i.test(filename)) return 7;

    // Database/Data layer
    if (/database|repository|dao|query/i.test(filename)) return 6;

    // UI Components
    if (/component|page|view/i.test(filename)) return 5;

    // Utilities
    if (/util|helper|tool/i.test(filename)) return 4;

    // Config files
    if (/config|setting/i.test(filename)) return 3;

    // Tests (lowest priority)
    if (/test|spec/i.test(filename)) return 1;

    return 5; // Default priority
}

/**
 * Smart agent selection to review files
 */
export const selectAgentsForFile = (filename: string, content: string): typeof reviewAgents => {
    const allAgents = [...reviewAgents];

    // For simple files, fewer agents have used to save cost
    const tokens = estimateTokens(content);
    if (tokens < 500) {
        // Small files: only security + performance
        return allAgents.filter(a =>
            a.name === 'security' || a.name === 'performance'
        );
    }

    // Security-critical files: prioritize security agent
    if (/auth|security|password|token|crypto|login/i.test(filename)) {
        return [
            allAgents.find(a => a.name === 'security')!,
            ...allAgents.filter(a => a.name !== 'security')
        ];
    }

    // API files: focus on security + performance
    if (/api|controller|route|handler/i.test(filename)) {
        return allAgents.filter(a =>
            a.name === 'security' ||
            a.name === 'performance' ||
            a.name === 'architecture'
        );
    }

    // Test files: only testing agent
    if (/test|spec/i.test(filename)) {
        return allAgents.filter(a => a.name === 'testing');
    }

    // Database files: performance + security
    if (/database|repository|dao|query|migration/i.test(filename)) {
        return allAgents.filter(a =>
            a.name === 'performance' ||
            a.name === 'security'
        );
    }

    // UI Components: readability + idiomatic
    if (/component|view|page\.(tsx|jsx)/i.test(filename)) {
        return allAgents.filter(a =>
            a.name === 'readability' ||
            a.name === 'idiomatic'
        );
    }

    // Default: All agents
    return allAgents;
}