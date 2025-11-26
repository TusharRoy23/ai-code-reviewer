import { SIMPLE_CHANGE_THRESHOLD, SKIP_PATTERNS } from "./filters.ts";
import { architectureAgent } from "../core/langgraph/agents/architectureAgent.ts";
import { idiomaticAgent } from "../core/langgraph/agents/idiomaticAgent.ts";
import { performanceAgent } from "../core/langgraph/agents/performanceAgent.ts";
import { readabilityAgent } from "../core/langgraph/agents/readabilityAgent.ts";
import { securityAgent } from "../core/langgraph/agents/securityAgent.ts";
import { testingAgent } from "../core/langgraph/agents/testingAgent.ts";

export const reviewAgents = [
    { name: "security", agent: securityAgent },
    { name: "performance", agent: performanceAgent },
    { name: "testing", agent: testingAgent },
    { name: "readability", agent: readabilityAgent },
    { name: "idiomatic", agent: idiomaticAgent },
    { name: "architecture", agent: architectureAgent },
];

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
    };
    return typeMap[ext] || ext.toUpperCase();
}

/**
 * Calculate priority score for a file (higher = more important)
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

    // Tests (lowest priority since we skip them anyway)
    if (/test|spec/i.test(filename)) return 1;

    return 5; // Default priority
}

/**
 * Select which agents should review this file (smart agent selection)
 */
export const selectAgentsForFile = (filename: string, content: string): typeof reviewAgents => {
    const allAgents = [...reviewAgents];

    // For simple files, use fewer agents to save cost
    const tokens = estimateTokens(content);
    if (tokens < 500) {
        // Small files: only security + performance
        return allAgents.filter(a =>
            a.name === 'security' || a.name === 'performance'
        );
    }

    // Security-critical files: prioritize security agent
    if (/auth|security|password|token|crypto|login/i.test(filename)) {
        // Move security to front
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

    // Default: use all agents
    return allAgents;
}

// Helper: Normalize issue types to catch variations
const normalizeIssueType = (type: string): string => {
    const normalized = type.toLowerCase().trim();

    // Map similar types together
    if (normalized.includes('sql') || normalized.includes('injection')) {
        return 'sql_injection';
    }
    if (normalized.includes('n+1') || normalized.includes('n + 1')) {
        return 'n_plus_one';
    }
    if (normalized.includes('memory') && normalized.includes('leak')) {
        return 'memory_leak';
    }

    return normalized;
}

function getSeverityScore(severity: string): number {
    const scores: Record<string, number> = {
        'critical': 4,
        'high': 3,
        'medium': 2,
        'low': 1
    };
    return scores[severity?.toLowerCase()] || 0;
}

// ──────────────────────────────
// DEDUPLICATION (Reduce Noise)
// ──────────────────────────────
export const deduplicateIssues = (reviews: any[]): any[] => {
    const seen = new Map<string, any>(); // Use Map to store best issue

    for (const review of reviews) {
        for (const issue of review.issues) {
            // Create a more robust signature
            const signature = `${issue.lineStart}-${issue.lineEnd}:${normalizeIssueType(issue.type)}`;

            const existing = seen.get(signature);

            if (!existing) {
                // First time seeing this issue
                seen.set(signature, { ...issue, agentName: review.type });
            } else {
                // Duplicate found - keep the one with higher severity
                if (getSeverityScore(issue.severity) > getSeverityScore(existing.severity)) {
                    seen.set(signature, { ...issue, agentName: review.type });
                }
            }
        }
    }

    // Group by agent type for the final output
    const deduplicated: any[] = [];
    const byAgent = new Map<string, any[]>();

    for (const issue of seen.values()) {
        const agentName = issue.agentName;
        if (!byAgent.has(agentName)) {
            byAgent.set(agentName, []);
        }
        byAgent.get(agentName)!.push(issue);
    }

    for (const [agentName, issues] of byAgent) {
        deduplicated.push({
            type: agentName,
            issues
        });
    }

    return deduplicated;
}

// Helper: Get most common value from array
export const getMostCommon = <T>(arr: T[]): T | undefined => {
    if (arr.length === 0) return undefined;

    const counts = new Map<T, number>();
    for (const item of arr) {
        counts.set(item, (counts.get(item) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon: T | undefined;

    for (const [item, count] of counts) {
        if (count > maxCount) {
            maxCount = count;
            mostCommon = item;
        }
    }

    return mostCommon;
}