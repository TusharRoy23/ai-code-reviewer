import fs from "fs";
import path from "path";
import type { Chunk, FileContext } from "./types.ts";

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

        // Parse code structure (language-aware)
        const functionsChanged = this.extractFunctions(diff, contentAfter, language);
        const classesChanged = this.extractClasses(diff, contentAfter, language);
        const importsAdded = this.extractImports(diff, '+', language);
        const importsRemoved = this.extractImports(diff, '-', language);

        // Determine file type
        const fileType = this.classifyFileType(filename, language);

        // Check if test file exists
        const hasTests = this.checkForTests(filename, language);

        // Find related files (files that import this one)
        const relatedFiles = this.findRelatedFiles(filename);

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
            relatedFiles
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
}