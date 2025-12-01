// graph/utils/types.ts

export enum Priority {
    CRITICAL = 'critical',
    HIGH = 'high',
    NORMAL = 'normal',
    LOW = 'low'
}

export enum Agents {
    SECURITY = 'security',
    PERFORMANCE = 'performance',
    ARCHITECTURE = 'architecture',
    TESTING = 'testing',
    READABILITY = 'readability',
    IDIOMATIC = 'idiomatic'
}

export interface Chunk {
    id: string;
    filename: string;
    content: string; // git diff
}

// NEW: Enriched file context
export interface FileContext {
    id: string;
    filename: string;
    fileType: 'auth' | 'api' | 'component' | 'util' | 'test' | 'config' | 'other';

    // Content
    diff: string;
    contentBefore: string | null;
    contentAfter: string | null;

    // Metadata
    linesAdded: number;
    linesRemoved: number;
    complexity?: {
        before: number;
        after: number;
    };

    // Parsed info
    changedLineRanges: Array<{ start: number; end: number }>;
    functionsChanged: string[];
    classesChanged: string[];
    importsAdded: string[];
    importsRemoved: string[];

    // Context
    hasTests: boolean;
    relatedFiles: string[];
}

// NEW: Agent plan from coordinator
export interface AgentPlan {
    filename: string;
    agents: string[]; // e.g., ['security', 'performance']
    priority: Priority;
    reasoning: string;
}

export interface Issue {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
    lineStart: number;
    lineEnd: number;
    confidence?: 'high' | 'medium' | 'low';
    category?: string;
}

export interface Review {
    chunkId: string;
    filename: string;
    agentType: string;
    issues: Issue[];
}