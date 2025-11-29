export type Issue = {
    severity: "critical" | "high" | "medium" | "low" | "info";
    type: string;
    description: string;
    recommendation?: string;
    lineStart?: number;
    lineEnd?: number;
}

export type Review = {
    chunkId: string;
    filename: string;
    issues: Issue[];
}

export type Chunk = {
    id: string;
    filename: string | undefined;
    content: string;
}