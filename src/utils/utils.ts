export interface ProjectContext {
    language: string;
    framework?: string;
    libraries: string[];
    database?: string;
    styleGuide?: string;
    architecture?: string;
    testFramework?: string;
    buildTool?: string;
}