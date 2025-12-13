import fs from "fs";
import path from "path";
import type { CallGraphNode, Chunk, FileContext, FunctionInfo, SecurityContext, TypeInfo } from "./types.ts";
import { ASTParser } from "./ast-parser.ts";

// Language-specific patterns
interface LanguagePatterns {
    functions: RegExp[];
    classes: RegExp[];
    imports: RegExp[];
    testFilePatterns: string[];
    fileExtensions: string[];
}

const LANGUAGE_PATTERNS: Record<string, LanguagePatterns> = {
    javascript: {
        functions: [
            /(?:function|const|let|var)\s+(\w+)\s*[=:]\s*(?:async\s*)?\(/g,
            /(\w+)\s*:\s*(?:async\s*)?function/g, // method: function
            /(\w+)\s*\([^)]*\)\s*{/g, // arrow/simple functions
        ],
        classes: [
            /class\s+(\w+)/g,
            /interface\s+(\w+)/g,
            /type\s+(\w+)\s*=/g,
        ],
        imports: [
            /import\s+.*from\s+['"](.+)['"]/g,
            /require\s*\(\s*['"](.+)['"]\s*\)/g,
        ],
        testFilePatterns: ['.test.', '.spec.', '__tests__/', 'tests/'],
        fileExtensions: ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs']
    },

    python: {
        functions: [
            /def\s+(\w+)\s*\(/g,
            /async\s+def\s+(\w+)\s*\(/g,
        ],
        classes: [
            /class\s+(\w+)/g,
        ],
        imports: [
            /from\s+(\S+)\s+import/g,
            /import\s+(\S+)/g,
        ],
        testFilePatterns: ['test_', '_test.py', 'tests/', 'test/'],
        fileExtensions: ['py', 'pyw']
    },

    java: {
        functions: [
            /(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*{/g,
        ],
        classes: [
            /(?:public|private|protected)?\s*(?:abstract|final)?\s*(?:class|interface|enum)\s+(\w+)/g,
        ],
        imports: [
            /import\s+(?:static\s+)?([^;]+);/g,
        ],
        testFilePatterns: ['Test.java', 'test/', 'Test/'],
        fileExtensions: ['java']
    },

    go: {
        functions: [
            /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/g,
        ],
        classes: [
            /type\s+(\w+)\s+(?:struct|interface)/g,
        ],
        imports: [
            /import\s+(?:[\w.]+\s+)?"([^"]+)"/g,
        ],
        testFilePatterns: ['_test.go'],
        fileExtensions: ['go']
    },

    rust: {
        functions: [
            /(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/g,
        ],
        classes: [
            /(?:pub\s+)?struct\s+(\w+)/g,
            /(?:pub\s+)?trait\s+(\w+)/g,
            /(?:pub\s+)?enum\s+(\w+)/g,
        ],
        imports: [
            /use\s+([^;]+);/g,
        ],
        testFilePatterns: ['test', 'tests/'],
        fileExtensions: ['rs']
    },

    cpp: {
        functions: [
            /(?:virtual\s+|static\s+|inline\s+)*[\w:<>]+\s+(\w+)\s*\([^)]*\)(?:\s+const)?\s*{/g,
        ],
        classes: [
            /(?:class|struct)\s+(\w+)/g,
        ],
        imports: [
            /#include\s+[<"]([^>"]+)[>"]/g,
        ],
        testFilePatterns: ['test', 'Test', '_test.', 'tests/'],
        fileExtensions: ['cpp', 'cc', 'cxx', 'c', 'h', 'hpp']
    },

    csharp: {
        functions: [
            /(?:public|private|protected|internal|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\(/g,
        ],
        classes: [
            /(?:public|private|protected|internal)?\s*(?:abstract|sealed|partial)?\s*(?:class|interface|struct)\s+(\w+)/g,
        ],
        imports: [
            /using\s+([^;]+);/g,
        ],
        testFilePatterns: ['Test.cs', 'Tests.cs', 'Tests/'],
        fileExtensions: ['cs']
    },

    ruby: {
        functions: [
            /def\s+(\w+)/g,
        ],
        classes: [
            /class\s+(\w+)/g,
            /module\s+(\w+)/g,
        ],
        imports: [
            /require\s+['"]([^'"]+)['"]/g,
            /require_relative\s+['"]([^'"]+)['"]/g,
        ],
        testFilePatterns: ['_test.rb', '_spec.rb', 'test/', 'spec/'],
        fileExtensions: ['rb']
    },

    php: {
        functions: [
            /(?:public|private|protected|static|\s)+function\s+(\w+)/g,
        ],
        classes: [
            /(?:abstract|final)?\s*class\s+(\w+)/g,
            /interface\s+(\w+)/g,
            /trait\s+(\w+)/g,
        ],
        imports: [
            /use\s+([^;]+);/g,
            /require(?:_once)?\s+['"]([^'"]+)['"]/g,
            /include(?:_once)?\s+['"]([^'"]+)['"]/g,
        ],
        testFilePatterns: ['Test.php', 'test/', 'tests/'],
        fileExtensions: ['php']
    },

    swift: {
        functions: [
            /func\s+(\w+)/g,
        ],
        classes: [
            /(?:class|struct|enum|protocol)\s+(\w+)/g,
        ],
        imports: [
            /import\s+(\w+)/g,
        ],
        testFilePatterns: ['Tests.swift', 'Test.swift', 'Tests/'],
        fileExtensions: ['swift']
    },

    kotlin: {
        functions: [
            /(?:fun|suspend\s+fun)\s+(\w+)/g,
        ],
        classes: [
            /(?:class|interface|object|enum\s+class)\s+(\w+)/g,
        ],
        imports: [
            /import\s+([^\n]+)/g,
        ],
        testFilePatterns: ['Test.kt', 'test/', 'tests/'],
        fileExtensions: ['kt', 'kts']
    },

    scala: {
        functions: [
            /def\s+(\w+)/g,
        ],
        classes: [
            /(?:class|trait|object)\s+(\w+)/g,
        ],
        imports: [
            /import\s+([^\n]+)/g,
        ],
        testFilePatterns: ['Spec.scala', 'Test.scala', 'test/'],
        fileExtensions: ['scala']
    }
};

export class ContextEnricher {
    private astParser: ASTParser;  // NEW

    constructor() {
        this.astParser = new ASTParser();  // NEW
    }

    enrichChunk(chunk: Chunk): FileContext {
        const filename = chunk.filename;
        const diff = chunk.content;

        // Detect language
        const language = this.detectLanguage(filename);

        // Get full file content
        const contentBefore = this.getFileContent(filename, 'before');
        const contentAfter = this.getFileContent(filename, 'after');

        // Parse diff metadata
        const linesAdded = (diff.match(/^\+(?!\+)/gm) || []).length;
        const linesRemoved = (diff.match(/^-(?!-)/gm) || []).length;

        // Extract changed line ranges from diff
        const changedLineRanges = this.extractLineRanges(diff);

        let functionsChanged: string[];
        let classesChanged: string[];
        let functionDetails: FunctionInfo[];
        let typeDefinitions: TypeInfo[];
        let callGraph: CallGraphNode[];

        const tree = contentAfter ? this.astParser.parse(contentAfter, filename) : null;
        if (tree) {
            // Get function names from diff (quick regex for names only)
            functionsChanged = this.extractFunctions(diff, contentAfter, language);
            classesChanged = this.extractClasses(diff, contentAfter, language);

            // Use AST for detailed extraction
            functionDetails = this.astParser.extractFunctions(
                tree,
                contentAfter!,
                functionsChanged,
                changedLineRanges
            );

            typeDefinitions = this.astParser.extractTypes(tree, contentAfter!);

            callGraph = this.astParser.buildCallGraph(
                tree,
                contentAfter!,
                functionsChanged
            );
        } else {
            // Fallback to regex (your existing code)
            functionsChanged = this.extractFunctions(diff, contentAfter, language);
            classesChanged = this.extractClasses(diff, contentAfter, language);

            // Use your existing smart context methods
            functionDetails = this.extractFunctionDetails(
                diff,
                contentBefore,
                contentAfter,
                functionsChanged,
                changedLineRanges,
                language
            );

            typeDefinitions = this.extractTypeDefinitions(contentAfter, language);
            callGraph = this.buildCallGraph(contentAfter, functionsChanged, language);
        }

        // Parse code structure (language-aware)
        const importsAdded = this.extractImports(diff, '+', language);
        const importsRemoved = this.extractImports(diff, '-', language);

        // Determine file type
        const fileType = this.classifyFileType(filename, language);

        // Check if test file exists
        const hasTests = this.checkForTests(filename, language);

        // Find related files (files that import this one)
        const relatedFiles = this.findRelatedFiles(filename);

        // Detect security-relevant patterns
        const securityContext = this.analyzeSecurityContext(
            diff,
            contentAfter,
            language
        );

        // Extract changed code blocks
        const changedCode = this.extractChangedCodeBlocks(diff);

        return {
            id: chunk.id,
            filename,
            fileType,
            diff,
            contentBefore,
            contentAfter,
            linesAdded,
            linesRemoved,
            changedLineRanges,
            functionsChanged,
            classesChanged,
            importsAdded,
            importsRemoved,
            hasTests,
            relatedFiles,
            // Smart context
            functionDetails,
            typeDefinitions,
            callGraph,
            securityContext,
            changedCode
        };
    }

    // ============================================
    // LANGUAGE DETECTION
    // ============================================
    private detectLanguage(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase() || '';

        for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
            if (patterns.fileExtensions.includes(ext)) {
                return lang;
            }
        }

        return 'unknown';
    }

    // ============================================
    // LANGUAGE-AWARE EXTRACTION
    // ============================================
    private extractFunctions(diff: string, content: string | null, language: string): string[] {
        if (!content) return [];

        const patterns = LANGUAGE_PATTERNS[language];
        if (!patterns) return [];

        const functions: string[] = [];
        const changedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));

        changedLines.forEach(line => {
            patterns.functions.forEach(regex => {
                // Reset regex
                regex.lastIndex = 0;
                let match;
                while ((match = regex.exec(line)) !== null) {
                    if (match[1]) {
                        functions.push(match[1]);
                    }
                }
            });
        });

        return [...new Set(functions)]; // dedupe
    }

    private extractClasses(diff: string, content: string | null, language: string): string[] {
        if (!content) return [];

        const patterns = LANGUAGE_PATTERNS[language];
        if (!patterns) return [];

        const classes: string[] = [];
        const changedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));

        changedLines.forEach(line => {
            patterns.classes.forEach(regex => {
                regex.lastIndex = 0;
                let match;
                while ((match = regex.exec(line)) !== null) {
                    if (match[1]) {
                        classes.push(match[1]);
                    }
                }
            });
        });

        return [...new Set(classes)];
    }

    private extractImports(diff: string, prefix: '+' | '-', language: string): string[] {
        const patterns = LANGUAGE_PATTERNS[language];
        if (!patterns) return [];

        const imports: string[] = [];
        const lines = diff.split('\n')
            .filter(line => line.startsWith(prefix) && !line.startsWith(prefix + prefix));

        lines.forEach(line => {
            patterns.imports.forEach(regex => {
                regex.lastIndex = 0;
                let match;
                while ((match = regex.exec(line)) !== null) {
                    if (match[1]) {
                        imports.push(match[1].trim());
                    }
                }
            });
        });

        return [...new Set(imports)];
    }

    // ============================================
    // FILE CLASSIFICATION
    // ============================================
    private classifyFileType(filename: string, language: string): FileContext['fileType'] {
        const patterns = LANGUAGE_PATTERNS[language];

        // Check if it's a test file
        if (patterns?.testFilePatterns.some(pattern => filename.includes(pattern))) {
            return 'test';
        }

        // Language-agnostic patterns
        if (filename.toLowerCase().includes('auth') || filename.toLowerCase().includes('login')) {
            return 'auth';
        }
        if (filename.toLowerCase().includes('api') || filename.toLowerCase().includes('route') || filename.toLowerCase().includes('controller')) {
            return 'api';
        }
        if (filename.toLowerCase().includes('component') || filename.match(/\.(tsx|jsx|vue|svelte)$/)) {
            return 'component';
        }
        if (filename.toLowerCase().includes('util') || filename.toLowerCase().includes('helper')) {
            return 'util';
        }
        if (filename.toLowerCase().match(/config|\.config\.|settings/)) {
            return 'config';
        }

        return 'other';
    }

    private checkForTests(filename: string, language: string): boolean {
        const patterns = LANGUAGE_PATTERNS[language];
        if (!patterns) return false;

        // Generate potential test file paths based on language conventions
        const testPaths: string[] = [];

        patterns.testFilePatterns.forEach(pattern => {
            if (pattern.endsWith('/')) {
                // Directory pattern: src/foo.py → tests/foo.py
                testPaths.push(filename.replace(/^(src|lib|app)\//, pattern));
            } else if (pattern.startsWith('_') || pattern.startsWith('.')) {
                // Prefix/suffix pattern: foo.py → foo_test.py or foo.test.py
                const parts = filename.split('.');
                const ext = parts.pop();
                const base = parts.join('.');
                testPaths.push(`${base}${pattern}${ext || ''}`);
            } else {
                // Simple contains pattern: Foo.java → FooTest.java
                const parts = filename.split('.');
                const ext = parts.pop();
                const base = parts.join('.');
                testPaths.push(`${base}${pattern}`);
            }
        });

        return testPaths.some(testPath => {
            try {
                return fs.existsSync(path.join(process.cwd(), testPath));
            } catch {
                return false;
            }
        });
    }

    // ============================================
    // HELPER METHODS
    // ============================================
    private getFileContent(filename: string, version: 'before' | 'after'): string | null {
        try {
            const fullPath = path.join(process.cwd(), filename);

            if (version === 'after') {
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    // Limit size to 50KB to save tokens
                    return content.length > 50000 ? content.slice(0, 50000) + '\n... (truncated)' : content;
                }
                return null;
            }

            // For 'before', we'd need git show HEAD^:filename
            // Skipping for simplicity in GitHub Actions
            return null;

        } catch (err) {
            console.error(`Failed to load ${version} content for: ${filename}`, err);
            return null;
        }
    }

    private extractLineRanges(diff: string): Array<{ start: number; end: number }> {
        const ranges: Array<{ start: number; end: number }> = [];
        const hunkRegex = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;

        let match;
        while ((match = hunkRegex.exec(diff)) !== null) {
            const start = parseInt(match[1]);
            const count = match[2] ? parseInt(match[2]) : 1;
            ranges.push({ start, end: start + count - 1 });
        }

        return ranges;
    }

    private findRelatedFiles(filename: string): string[] {
        // Simple implementation: look for files that might import this one
        // In a real implementation, you'd use grep or AST parsing
        return [];
    }

    // ============================================
    // SMART CONTEXT METHODS
    // ============================================
    /**
     * Extract complete function bodies, not just names
     */
    private extractFunctionDetails(
        diff: string,
        contentBefore: string | null,
        contentAfter: string | null,
        functionsChanged: string[],
        changedLineRanges: Array<{ start: number; end: number }>,
        language: string
    ): FunctionInfo[] {
        if (!contentAfter) return [];

        const details: FunctionInfo[] = [];
        const lines = contentAfter.split('\n');

        for (const funcName of functionsChanged) {
            const funcInfo = this.findFunctionBody(
                funcName,
                lines,
                contentBefore,
                language
            );

            if (funcInfo) {
                // Check if this function overlaps with changed lines
                const isModified = changedLineRanges.some(range =>
                    (funcInfo.lineStart >= range.start && funcInfo.lineStart <= range.end) ||
                    (funcInfo.lineEnd >= range.start && funcInfo.lineEnd <= range.end)
                );

                details.push({
                    ...funcInfo,
                    isModified,
                    isNew: !contentBefore?.includes(funcName),
                    isDeleted: false
                });
            }
        }

        return details;
    }

    /**
     * Find complete function body with signature
     */
    private findFunctionBody(
        funcName: string,
        lines: string[],
        contentBefore: string | null,
        language: string
    ): Omit<FunctionInfo, 'isModified' | 'isNew' | 'isDeleted'> | null {
        const patterns = LANGUAGE_PATTERNS[language];
        if (!patterns) return null;

        let functionStartLine = -1;
        let functionEndLine = -1;
        let signature = '';

        // Find function declaration
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check if this line contains the function name
            if (line.includes(funcName)) {
                // Try to match function patterns
                for (const pattern of patterns.functions) {
                    pattern.lastIndex = 0;
                    const match = pattern.exec(line);
                    if (match && match[1] === funcName) {
                        functionStartLine = i + 1; // 1-indexed
                        signature = line.trim();
                        break;
                    }
                }
            }

            if (functionStartLine !== -1) break;
        }

        if (functionStartLine === -1) return null;

        // Find function end by counting braces
        const startIdx = functionStartLine - 1;
        let braceCount = 0;
        let foundStart = false;

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i];

            for (const char of line) {
                if (char === '{') {
                    braceCount++;
                    foundStart = true;
                } else if (char === '}') {
                    braceCount--;
                    if (foundStart && braceCount === 0) {
                        functionEndLine = i + 1;
                        break;
                    }
                }
            }

            if (functionEndLine !== -1) break;

            // Safety: don't go more than 200 lines
            if (i - startIdx > 200) {
                functionEndLine = i;
                break;
            }
        }

        if (functionEndLine === -1) {
            functionEndLine = Math.min(startIdx + 50, lines.length);
        }

        // Extract body
        const bodyAfter = lines.slice(startIdx, functionEndLine).join('\n');

        // Try to get before version
        let bodyBefore: string | null = null;
        if (contentBefore) {
            const beforeLines = contentBefore.split('\n');
            const beforeInfo = this.findFunctionBody(funcName, beforeLines, null, language);
            bodyBefore = beforeInfo?.bodyAfter || null;
        }

        return {
            name: funcName,
            signature,
            bodyBefore,
            bodyAfter,
            lineStart: functionStartLine,
            lineEnd: functionEndLine,
            complexity: this.calculateComplexity(bodyAfter)
        };
    }

    /**
     * Calculate cyclomatic complexity (simple version)
     */
    private calculateComplexity(code: string): number {
        // Count decision points: if, for, while, case, catch, &&, ||, ?
        const patterns = [
            /\bif\s*\(/g,
            /\bfor\s*\(/g,
            /\bwhile\s*\(/g,
            /\bcase\s+/g,
            /\bcatch\s*\(/g,
            /&&/g,
            /\|\|/g,
            /\?/g
        ];

        let complexity = 1; // base complexity

        for (const pattern of patterns) {
            const matches = code.match(pattern);
            if (matches) complexity += matches.length;
        }

        return complexity;
    }

    /**
     * Extract type definitions (interfaces, types, classes)
     */
    private extractTypeDefinitions(
        content: string | null,
        language: string
    ): TypeInfo[] {
        if (!content) return [];

        const types: TypeInfo[] = [];
        const lines = content.split('\n');

        // TypeScript/JavaScript interfaces and types
        if (language === 'javascript') {
            lines.forEach((line, idx) => {
                // Interface
                const interfaceMatch = line.match(/interface\s+(\w+)/);
                if (interfaceMatch) {
                    types.push({
                        name: interfaceMatch[1],
                        definition: this.extractBlock(lines, idx),
                        kind: 'interface',
                        lineNumber: idx + 1
                    });
                }

                // Type alias
                const typeMatch = line.match(/type\s+(\w+)\s*=/);
                if (typeMatch) {
                    types.push({
                        name: typeMatch[1],
                        definition: line.trim(),
                        kind: 'type',
                        lineNumber: idx + 1
                    });
                }

                // Class
                const classMatch = line.match(/class\s+(\w+)/);
                if (classMatch) {
                    types.push({
                        name: classMatch[1],
                        definition: this.extractBlock(lines, idx),
                        kind: 'class',
                        lineNumber: idx + 1
                    });
                }
            });
        }

        // Python classes
        if (language === 'python') {
            lines.forEach((line, idx) => {
                const classMatch = line.match(/class\s+(\w+)/);
                if (classMatch) {
                    types.push({
                        name: classMatch[1],
                        definition: this.extractBlock(lines, idx),
                        kind: 'class',
                        lineNumber: idx + 1
                    });
                }
            });
        }

        // Add more languages as needed...

        return types;
    }

    /**
     * Extract a code block (for types, classes, etc.)
     */
    private extractBlock(lines: string[], startIdx: number, maxLines: number = 30): string {
        const result: string[] = [lines[startIdx]];
        let braceCount = 0;
        let foundStart = false;

        for (let i = startIdx; i < Math.min(lines.length, startIdx + maxLines); i++) {
            const line = lines[i];

            for (const char of line) {
                if (char === '{') {
                    braceCount++;
                    foundStart = true;
                } else if (char === '}') {
                    braceCount--;
                }
            }

            if (i > startIdx) result.push(line);

            if (foundStart && braceCount === 0) break;
        }

        return result.join('\n');
    }

    /**
     * Build a simple call graph
     */
    private buildCallGraph(
        content: string | null,
        changedFunctions: string[],
        language: string
    ): CallGraphNode[] {
        if (!content) return [];

        const graph: CallGraphNode[] = [];
        const allFunctions = this.extractAllFunctionNames(content, language);

        for (const funcName of allFunctions) {
            const calls = this.findFunctionCalls(content, funcName);
            const calledBy = this.findWhoCallsFunction(content, funcName, allFunctions);

            graph.push({
                functionName: funcName,
                calls,
                calledBy,
                isChangedFunction: changedFunctions.includes(funcName)
            });
        }

        return graph;
    }

    private extractAllFunctionNames(content: string, language: string): string[] {
        const patterns = LANGUAGE_PATTERNS[language];
        if (!patterns) return [];

        const functions: string[] = [];

        patterns.functions.forEach(regex => {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(content)) !== null) {
                if (match[1]) functions.push(match[1]);
            }
        });

        return [...new Set(functions)];
    }

    private findFunctionCalls(content: string, functionName: string): string[] {
        // Simple: find "functionName(" in the code
        const regex = new RegExp(`\\b(\\w+)\\s*\\(`, 'g');
        const calls: string[] = [];

        let match;
        while ((match = regex.exec(content)) !== null) {
            if (match[1] !== functionName) { // Don't include self
                calls.push(match[1]);
            }
        }

        return [...new Set(calls)];
    }

    private findWhoCallsFunction(
        content: string,
        targetFunction: string,
        allFunctions: string[]
    ): string[] {
        const callers: string[] = [];
        const lines = content.split('\n');

        // For each line that calls targetFunction
        lines.forEach(line => {
            if (line.includes(`${targetFunction}(`)) {
                // Try to figure out which function this line is in
                // (This is simplified - in reality you'd track scope properly)
                for (const func of allFunctions) {
                    if (func !== targetFunction && line.includes(func)) {
                        callers.push(func);
                        break;
                    }
                }
            }
        });

        return [...new Set(callers)];
    }

    /**
     * Analyze security-relevant patterns
     */
    private analyzeSecurityContext(
        diff: string,
        content: string | null,
        language: string
    ): SecurityContext {
        const fullText = content || diff;

        return {
            hasUserInput: this.hasPattern(fullText, [
                /req\.(body|query|params|headers)/,
                /process\.argv/,
                /input\(/,  // Python
                /Scanner\(/,  // Java
                /gets\(/,  // C
            ]),

            hasDatabaseQuery: this.hasPattern(fullText, [
                /\.(query|execute|raw)\s*\(/,
                /SELECT|INSERT|UPDATE|DELETE/i,
                /db\./,
                /cursor\./,
            ]),

            hasFileOperation: this.hasPattern(fullText, [
                /fs\.(read|write|open|unlink)/,
                /open\s*\(/,
                /fopen|fread|fwrite/,
            ]),

            hasNetworkCall: this.hasPattern(fullText, [
                /fetch\s*\(/,
                /axios\./,
                /http\.(get|post|request)/,
                /requests\./,  // Python
            ]),

            hasAuthCode: this.hasPattern(fullText, [
                /auth|login|token|jwt|session/i,
                /password|credential/i,
            ]),

            hasCryptoOperation: this.hasPattern(fullText, [
                /crypto\./,
                /encrypt|decrypt|hash/i,
                /bcrypt|scrypt/,
                /md5|sha1|sha256/i,
            ]),

            exposesAPI: this.hasPattern(fullText, [
                /app\.(get|post|put|delete|patch)/,
                /@(Get|Post|Put|Delete)/,  // Decorators
                /Route\(/,
            ])
        };
    }

    private hasPattern(text: string, patterns: RegExp[]): boolean {
        return patterns.some(pattern => pattern.test(text));
    }

    /**
     * Extract changed code blocks (additions and deletions)
     */
    private extractChangedCodeBlocks(diff: string): { additions: string[]; deletions: string[] } {
        const lines = diff.split('\n');
        const additions: string[] = [];
        const deletions: string[] = [];

        let currentAddBlock: string[] = [];
        let currentDelBlock: string[] = [];

        for (const line of lines) {
            if (line.startsWith('+') && !line.startsWith('+++')) {
                currentAddBlock.push(line.slice(1)); // Remove '+'

                // If we were building a deletion block, save it
                if (currentDelBlock.length > 0) {
                    deletions.push(currentDelBlock.join('\n'));
                    currentDelBlock = [];
                }
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                currentDelBlock.push(line.slice(1)); // Remove '-'

                // If we were building an addition block, save it
                if (currentAddBlock.length > 0) {
                    additions.push(currentAddBlock.join('\n'));
                    currentAddBlock = [];
                }
            } else {
                // Context line or diff header
                if (currentAddBlock.length > 0) {
                    additions.push(currentAddBlock.join('\n'));
                    currentAddBlock = [];
                }
                if (currentDelBlock.length > 0) {
                    deletions.push(currentDelBlock.join('\n'));
                    currentDelBlock = [];
                }
            }
        }

        // Save any remaining blocks
        if (currentAddBlock.length > 0) {
            additions.push(currentAddBlock.join('\n'));
        }
        if (currentDelBlock.length > 0) {
            deletions.push(currentDelBlock.join('\n'));
        }

        return { additions, deletions };
    }
}