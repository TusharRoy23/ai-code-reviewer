export enum Priority {
    CRITICAL = 'critical',
    HIGH = 'high',
    NORMAL = 'normal',
    LOW = 'low'
}

export enum Severity {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

export enum Agents {
    SECURITY = 'security',
    PERFORMANCE = 'performance',
    ARCHITECTURE = 'architecture',
    TESTING = 'testing',
    READABILITY = 'readability',
    IDIOMATIC = 'idiomatic',
    BUGS = 'bugs'
}

export interface Chunk {
    id: string;
    filename: string;
    content: string; // git diff
}

// Function/method details
export interface FunctionInfo {
    name: string;
    signature: string;
    bodyBefore: string | null;
    bodyAfter: string | null;
    lineStart: number;
    lineEnd: number;
    isModified: boolean;
    isNew: boolean;
    isDeleted: boolean;
    complexity?: number; // cyclomatic complexity
}

// Type/interface details
export interface TypeInfo {
    name: string;
    definition: string;
    kind: 'interface' | 'type' | 'class' | 'enum' | 'struct';
    lineNumber: number;
}

// Security context
export interface SecurityContext {
    hasUserInput: boolean;         // req.body, req.query, argv, etc.
    hasDatabaseQuery: boolean;     // SQL, db.query, execute
    hasFileOperation: boolean;     // fs.read, open, write
    hasNetworkCall: boolean;       // fetch, http, axios
    hasAuthCode: boolean;          // login, authenticate, token
    hasCryptoOperation: boolean;   // encrypt, hash, crypto
    exposesAPI: boolean;           // @route, app.get, express
}

// Call graph info
export interface CallGraphNode {
    functionName: string;
    calledBy: string[];      // Functions that call this
    calls: string[];         // Functions this one calls
    isChangedFunction: boolean;
}

// Enriched file context
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

    // Smart context
    functionDetails: FunctionInfo[];     // Full function bodies, not just names
    typeDefinitions: TypeInfo[];          // Interfaces, types, classes
    callGraph: CallGraphNode[];           // Who calls whom
    securityContext: SecurityContext;     // Security-relevant patterns
    changedCode: {                        // The actual changed code blocks
        additions: string[];
        deletions: string[];
    };
}

// Agent plan from coordinator
export interface AgentPlan {
    filename: string;
    agents: string[]; // e.g., ['security', 'performance']
    priority: Priority;
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

export type Summary = {
    totalIssues: number;
    totalFilesReviewed: number;
    [Severity.CRITICAL]: number;
    [Severity.HIGH]: number;
    [Severity.LOW]: number;
    [Severity.MEDIUM]: number;
}

export type Findings = {
    file: string;
    agent: string;
    issues: Issue[];
}

export type FinalizeReview = {
    summary: Summary;
    findings: Findings[];
    verdict?: string;
}