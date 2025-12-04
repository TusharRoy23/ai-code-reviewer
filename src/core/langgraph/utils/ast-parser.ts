import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import Python from "tree-sitter-python";
import Go from "tree-sitter-go";
import Rust from "tree-sitter-rust";
import Java from "tree-sitter-java";
import Cpp from "tree-sitter-cpp";
import CSharp from "tree-sitter-c-sharp";
import Ruby from "tree-sitter-ruby";
// import PHP from "tree-sitter-php";

import type { FunctionInfo, TypeInfo, CallGraphNode } from "./types.ts";

interface ASTNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    children: ASTNode[];
    childForFieldName(field: string): ASTNode | null;
    namedChildren: ASTNode[];
}

export class ASTParser {
    private parsers: Map<string, Parser>;

    constructor() {
        this.parsers = new Map();
        this.initializeParsers();
    }

    /**
     * Initialize parsers for all supported languages
     */
    private initializeParsers() {
        // JavaScript
        const jsParser = new Parser();
        jsParser.setLanguage(JavaScript);
        this.parsers.set('javascript', jsParser);

        // TypeScript
        const tsParser = new Parser();
        tsParser.setLanguage(TypeScript.typescript);
        this.parsers.set('typescript', tsParser);

        // TSX (React)
        const tsxParser = new Parser();
        tsxParser.setLanguage(TypeScript.tsx);
        this.parsers.set('tsx', tsxParser);

        // Python
        const pyParser = new Parser();
        pyParser.setLanguage(Python);
        this.parsers.set('python', pyParser);

        // // Go
        const goParser = new Parser();
        goParser.setLanguage(Go);
        this.parsers.set('go', goParser);

        // Rust
        const rustParser = new Parser();
        rustParser.setLanguage(Rust);
        this.parsers.set('rust', rustParser);

        // // Java
        const javaParser = new Parser();
        javaParser.setLanguage(Java);
        this.parsers.set('java', javaParser);

        // // C++
        const cppParser = new Parser();
        cppParser.setLanguage(Cpp);
        this.parsers.set('cpp', cppParser);

        // C#
        const csParser = new Parser();
        csParser.setLanguage(CSharp);
        this.parsers.set('csharp', csParser);

        // Ruby
        const rubyParser = new Parser();
        rubyParser.setLanguage(Ruby);
        this.parsers.set('ruby', rubyParser);

        // PHP
        // const phpParser = new Parser();
        // phpParser.setLanguage(PHP as any);
        // this.parsers.set('php', phpParser);
    }

    /**
     * Map file extension to parser language
     */
    private getParserLanguage(filename: string): string | null {
        const ext = filename.split('.').pop()?.toLowerCase();

        const mapping: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'javascript',
            'mjs': 'javascript',
            'cjs': 'javascript',
            'ts': 'typescript',
            'tsx': 'tsx',
            'py': 'python',
            'go': 'go',
            'rs': 'rust',
            'java': 'java',
            'cpp': 'cpp',
            'cc': 'cpp',
            'cxx': 'cpp',
            'c': 'cpp',
            'h': 'cpp',
            'hpp': 'cpp',
            'cs': 'csharp',
            'rb': 'ruby',
            'php': 'php'
        };

        return mapping[ext || ''] || null;
    }

    /**
     * Parse code and return AST tree
     */
    parse(code: string, filename: string): any | null {
        const language = this.getParserLanguage(filename);
        if (!language) {
            console.warn(`No parser available for ${filename}`);
            return null;
        }

        const parser = this.parsers.get(language);
        if (!parser) {
            console.warn(`Parser not initialized for ${language}`);
            return null;
        }

        try {
            const tree = parser.parse(code);
            return tree;
        } catch (error) {
            console.error(`Failed to parse ${filename}:`, error);
            return null;
        }
    }

    /**
     * Extract function details with EXACT boundaries
     */
    extractFunctions(
        tree: any,
        code: string,
        changedFunctionNames: string[],
        changedLineRanges: Array<{ start: number; end: number }>
    ): FunctionInfo[] {
        if (!tree) return [];

        const functions: FunctionInfo[] = [];
        const rootNode = tree.rootNode;

        // Find all function-like nodes
        this.walkTree(rootNode, (node: ASTNode) => {
            if (this.isFunctionNode(node)) {
                const funcInfo = this.extractFunctionInfo(node, code, changedLineRanges);
                if (funcInfo && changedFunctionNames.includes(funcInfo.name)) {
                    functions.push(funcInfo);
                }
            }
        });

        return functions;
    }

    /**
     * Check if node is a function
     */
    private isFunctionNode(node: ASTNode): boolean {
        const functionTypes = [
            'function_declaration',      // JS/TS: function foo() {}
            'function',                  // JS/TS: anonymous
            'arrow_function',            // JS/TS: () => {}
            'method_definition',         // JS/TS: class methods
            'function_definition',       // Python: def foo():
            'function_declaration',      // Go: func foo() {}
            'function_item',             // Rust: fn foo() {}
            'method_declaration',        // Java: public void foo() {}
            'constructor_declaration',   // Java/C#: constructors
            'method_definition'          // Ruby: def foo
        ];

        return functionTypes.includes(node.type);
    }

    /**
     * Extract detailed function information
     */
    private extractFunctionInfo(
        node: ASTNode,
        code: string,
        changedLineRanges: Array<{ start: number; end: number }>
    ): FunctionInfo | null {
        try {
            // Get function name
            const nameNode = this.getFunctionName(node);
            if (!nameNode) return null;

            const name = nameNode.text;
            const startLine = node.startPosition.row + 1; // 1-indexed
            const endLine = node.endPosition.row + 1;

            // Extract signature (first line)
            const lines = code.split('\n');
            const signature = lines[startLine - 1]?.trim() || '';

            // Get full function body
            const bodyAfter = node.text;

            // Check if function is modified
            const isModified = changedLineRanges.some(range =>
                (startLine >= range.start && startLine <= range.end) ||
                (endLine >= range.start && endLine <= range.end) ||
                (startLine <= range.start && endLine >= range.end)
            );

            // Calculate complexity
            const complexity = this.calculateComplexity(node);

            return {
                name,
                signature,
                bodyBefore: null, // We don't have "before" version easily
                bodyAfter,
                lineStart: startLine,
                lineEnd: endLine,
                isModified,
                isNew: false, // Determined elsewhere
                isDeleted: false,
                complexity
            };
        } catch (error) {
            console.error('Error extracting function info:', error);
            return null;
        }
    }

    /**
     * Get function name from node
     */
    private getFunctionName(node: ASTNode): ASTNode | null {
        // Try common name fields
        const nameFields = ['name', 'property', 'key'];

        for (const field of nameFields) {
            const nameNode = node.childForFieldName(field);
            if (nameNode) return nameNode;
        }

        // For arrow functions, check if any child looks like a name
        for (const child of node.namedChildren) {
            if (child.type === 'identifier') {
                return child;
            }
        }

        return null;
    }

    /**
     * Calculate cyclomatic complexity from AST
     */
    private calculateComplexity(node: ASTNode): number {
        let complexity = 1; // Base complexity

        this.walkTree(node, (n: ASTNode) => {
            // Decision points
            if ([
                'if_statement',
                'for_statement',
                'while_statement',
                'case_statement',
                'catch_clause',
                'conditional_expression',  // ternary
                'binary_expression'        // && ||
            ].includes(n.type)) {
                // Check for && || in binary expressions
                if (n.type === 'binary_expression') {
                    const operator = n.children.find(c => c.type === 'operator');
                    if (operator && ['&&', '||'].includes(operator.text)) {
                        complexity++;
                    }
                } else {
                    complexity++;
                }
            }
        });

        return complexity;
    }

    /**
     * Extract type definitions (interfaces, types, classes)
     */
    extractTypes(tree: any, code: string): TypeInfo[] {
        if (!tree) return [];

        const types: TypeInfo[] = [];
        const rootNode = tree.rootNode;

        this.walkTree(rootNode, (node: ASTNode) => {
            if (this.isTypeNode(node)) {
                const typeInfo = this.extractTypeInfo(node, code);
                if (typeInfo) types.push(typeInfo);
            }
        });

        return types;
    }

    /**
     * Check if node is a type definition
     */
    private isTypeNode(node: ASTNode): boolean {
        const typeNodes = [
            'interface_declaration',     // TS: interface Foo {}
            'type_alias_declaration',    // TS: type Foo = ...
            'class_declaration',         // JS/TS/Java/Python: class Foo {}
            'enum_declaration',          // TS/Java: enum Foo {}
            'struct_declaration',        // Go/Rust: struct Foo {}
            'trait_declaration'          // Rust: trait Foo {}
        ];

        return typeNodes.includes(node.type);
    }

    /**
     * Extract type information
     */
    private extractTypeInfo(node: ASTNode, code: string): TypeInfo | null {
        try {
            const nameNode = node.childForFieldName('name');
            if (!nameNode) return null;

            const name = nameNode.text;
            const lineNumber = node.startPosition.row + 1;

            // Determine kind
            let kind: TypeInfo['kind'] = 'class';
            if (node.type.includes('interface')) kind = 'interface';
            else if (node.type.includes('type')) kind = 'type';
            else if (node.type.includes('enum')) kind = 'enum';
            else if (node.type.includes('struct')) kind = 'struct';

            // Get definition (limited to first 30 lines)
            const definition = this.getNodeText(node, code, 30);

            return {
                name,
                definition,
                kind,
                lineNumber
            };
        } catch (error) {
            console.error('Error extracting type info:', error);
            return null;
        }
    }

    /**
     * Build call graph
     */
    buildCallGraph(tree: any, code: string, changedFunctions: string[]): CallGraphNode[] {
        if (!tree) return [];

        const graph: CallGraphNode[] = [];
        const allFunctions = this.getAllFunctionNames(tree);
        const rootNode = tree.rootNode;

        // For each function, find what it calls
        allFunctions.forEach(funcName => {
            const functionNode = this.findFunctionNode(rootNode, funcName);
            if (!functionNode) return;

            const calls = this.findCallsInFunction(functionNode);
            const calledBy = this.findCallersOfFunction(rootNode, funcName);

            graph.push({
                functionName: funcName,
                calls,
                calledBy,
                isChangedFunction: changedFunctions.includes(funcName)
            });
        });

        return graph;
    }

    /**
     * Get all function names
     */
    private getAllFunctionNames(tree: any): string[] {
        const names: string[] = [];

        this.walkTree(tree.rootNode, (node: ASTNode) => {
            if (this.isFunctionNode(node)) {
                const nameNode = this.getFunctionName(node);
                if (nameNode) names.push(nameNode.text);
            }
        });

        return [...new Set(names)];
    }

    /**
     * Find function node by name
     */
    private findFunctionNode(rootNode: ASTNode, funcName: string): ASTNode | null {
        let found: ASTNode | null = null;

        this.walkTree(rootNode, (node: ASTNode) => {
            if (this.isFunctionNode(node)) {
                const nameNode = this.getFunctionName(node);
                if (nameNode?.text === funcName) {
                    found = node;
                    return true; // Stop walking
                }
            }
        });

        return found;
    }

    /**
     * Find all function calls within a function
     */
    private findCallsInFunction(functionNode: ASTNode): string[] {
        const calls: string[] = [];

        this.walkTree(functionNode, (node: ASTNode) => {
            if (node.type === 'call_expression' || node.type === 'call') {
                const calleeNode = node.childForFieldName('function') ||
                    node.childForFieldName('callee') ||
                    node.children[0];

                if (calleeNode) {
                    // Handle member expressions like "obj.method()"
                    if (calleeNode.type === 'member_expression' ||
                        calleeNode.type === 'attribute') {
                        const property = calleeNode.childForFieldName('property');
                        if (property) calls.push(property.text);
                    } else {
                        calls.push(calleeNode.text);
                    }
                }
            }
        });

        return [...new Set(calls)];
    }

    /**
     * Find who calls a given function
     */
    private findCallersOfFunction(rootNode: ASTNode, targetFunc: string): string[] {
        const callers: string[] = [];
        let currentFunction: string | null = null;

        this.walkTree(rootNode, (node: ASTNode) => {
            // Track current function context
            if (this.isFunctionNode(node)) {
                const nameNode = this.getFunctionName(node);
                currentFunction = nameNode?.text || null;
            }

            // Check if this is a call to targetFunc
            if (node.type === 'call_expression' || node.type === 'call') {
                const calleeNode = node.childForFieldName('function') ||
                    node.childForFieldName('callee') ||
                    node.children[0];

                if (calleeNode) {
                    const calleeName = calleeNode.type === 'member_expression' ?
                        calleeNode.childForFieldName('property')?.text :
                        calleeNode.text;

                    if (calleeName === targetFunc && currentFunction && currentFunction !== targetFunc) {
                        callers.push(currentFunction);
                    }
                }
            }
        });

        return [...new Set(callers)];
    }

    /**
     * Walk AST tree
     */
    private walkTree(node: ASTNode, callback: (node: ASTNode) => boolean | void) {
        const shouldStop = callback(node);
        if (shouldStop) return;

        for (const child of node.namedChildren) {
            this.walkTree(child, callback);
        }
    }

    /**
     * Get node text with line limit
     */
    private getNodeText(node: ASTNode, code: string, maxLines: number = 50): string {
        const lines = code.split('\n');
        const startLine = node.startPosition.row;
        const endLine = Math.min(node.endPosition.row, startLine + maxLines);

        return lines.slice(startLine, endLine + 1).join('\n');
    }
}