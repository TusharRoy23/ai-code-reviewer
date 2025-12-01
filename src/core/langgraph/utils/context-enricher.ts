// graph/utils/context-enricher.ts
import fs from "fs";
import path from "path";
import type { Chunk, FileContext } from "./types.ts";

export class ContextEnricher {

    enrichChunk(chunk: Chunk): FileContext {
        const filename = chunk.filename;
        const diff = chunk.content;

        // Get full file content
        const contentBefore = this.getFileContent(filename, 'before');
        const contentAfter = this.getFileContent(filename, 'after');

        // Parse diff metadata
        const linesAdded = (diff.match(/^\+(?!\+)/gm) || []).length;
        const linesRemoved = (diff.match(/^-(?!-)/gm) || []).length;

        // Extract changed line ranges from diff
        const changedLineRanges = this.extractLineRanges(diff);

        // Parse code structure
        const functionsChanged = this.extractFunctions(diff, contentAfter);
        const classesChanged = this.extractClasses(diff, contentAfter);
        const importsAdded = this.extractImports(diff, '+');
        const importsRemoved = this.extractImports(diff, '-');

        // Determine file type
        const fileType = this.classifyFileType(filename);

        // Check if test file exists
        const hasTests = this.checkForTests(filename);

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

    private getFileContent(filename: string, version: 'before' | 'after'): string | null {
        try {
            const fullPath = path.join(process.cwd(), filename);

            // For 'after', just read current file
            if (version === 'after') {
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    // Limit size to 50KB to save tokens
                    return content.length > 50000 ? content.slice(0, 50000) + '\n... (truncated)' : content;
                }
                return null;
            }

            // For 'before', we'd need git show HEAD^:filename
            // For simplicity, we'll skip this in GitHub Actions
            // The diff already shows what changed
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

    private extractFunctions(diff: string, content: string | null): string[] {
        if (!content) return [];

        const functions: string[] = [];

        // Simple regex for function declarations (works for TS/JS)
        const funcRegex = /(?:function|const|let|var)\s+(\w+)\s*[=:]\s*(?:async\s*)?\(/g;
        const changedLines = diff.split('\n').filter(l => l.startsWith('+'));

        changedLines.forEach(line => {
            let match;
            while ((match = funcRegex.exec(line)) !== null) {
                functions.push(match[1]);
            }
        });

        return [...new Set(functions)]; // dedupe
    }

    private extractClasses(diff: string, content: string | null): string[] {
        if (!content) return [];

        const classes: string[] = [];
        const classRegex = /class\s+(\w+)/g;
        const changedLines = diff.split('\n').filter(l => l.startsWith('+'));

        changedLines.forEach(line => {
            let match;
            while ((match = classRegex.exec(line)) !== null) {
                classes.push(match[1]);
            }
        });

        return [...new Set(classes)];
    }

    private extractImports(diff: string, prefix: '+' | '-'): string[] {
        const imports: string[] = [];
        const importRegex = /import\s+.*from\s+['"](.+)['"]/;

        diff.split('\n')
            .filter(line => line.startsWith(prefix) && line.includes('import'))
            .forEach(line => {
                const match = line.match(importRegex);
                if (match) imports.push(match[1]);
            });

        return imports;
    }

    private classifyFileType(filename: string): FileContext['fileType'] {
        if (filename.includes('test') || filename.includes('spec')) return 'test';
        if (filename.includes('auth') || filename.includes('login')) return 'auth';
        if (filename.includes('api') || filename.includes('route')) return 'api';
        if (filename.includes('component') || filename.match(/\.(tsx|jsx|vue)$/)) return 'component';
        if (filename.includes('util') || filename.includes('helper')) return 'util';
        if (filename.match(/config|\.config\./)) return 'config';
        return 'other';
    }

    private checkForTests(filename: string): boolean {
        const testPaths = [
            filename.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1'),
            filename.replace(/\.(ts|js|tsx|jsx)$/, '.spec.$1'),
            filename.replace(/src\//, 'tests/'),
            filename.replace(/src\//, '__tests__/')
        ];

        return testPaths.some(testPath => {
            try {
                return fs.existsSync(path.join(process.cwd(), testPath));
            } catch {
                return false;
            }
        });
    }

    private findRelatedFiles(filename: string): string[] {
        // Simple implementation: look for files that might import this one
        // In a real implementation, you'd use an AST parser or grep
        return [];
    }
}