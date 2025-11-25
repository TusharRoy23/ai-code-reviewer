import { Chunk } from "../core/langgraph/state.ts";
import { getFileType, getMostCommon } from "./helper.ts";
import { ProjectContext } from "./utils.ts";

// ──────────────────────────────────────────────────────────────
// DETECT FRAMEWORK FROM IMPORTS/CODE
// ──────────────────────────────────────────────────────────────
export const detectFrameworkFromCode = (content: string, filename: string): string | undefined => {
    const cleanContent = content.toLowerCase();

    // React detection
    if (
        cleanContent.includes('import react') ||
        cleanContent.includes('from "react"') ||
        cleanContent.includes("from 'react'") ||
        /\.(tsx|jsx)$/.test(filename)
    ) {
        // Check for Next.js
        if (
            cleanContent.includes('next/') ||
            cleanContent.includes('from "next') ||
            cleanContent.includes('import { useRouter } from')
        ) {
            return 'Next.js';
        }
        return 'React';
    }

    // Vue detection
    if (
        cleanContent.includes('import vue') ||
        cleanContent.includes('<template>') ||
        /\.vue$/.test(filename)
    ) {
        return 'Vue.js';
    }

    // Angular detection
    if (
        cleanContent.includes('@angular/') ||
        cleanContent.includes('@component') ||
        cleanContent.includes('@injectable')
    ) {
        return 'Angular';
    }

    // Svelte detection
    if (/\.svelte$/.test(filename)) {
        return 'Svelte';
    }

    // Express.js detection
    if (
        cleanContent.includes('express()') ||
        cleanContent.includes('from "express"') ||
        cleanContent.includes("require('express')")
    ) {
        return 'Express.js';
    }

    // NestJS detection
    if (
        cleanContent.includes('@nestjs/') ||
        cleanContent.includes('@controller') ||
        cleanContent.includes('@module')
    ) {
        return 'NestJS';
    }

    // FastAPI detection
    if (
        cleanContent.includes('from fastapi') ||
        cleanContent.includes('import fastapi')
    ) {
        return 'FastAPI';
    }

    // Django detection
    if (
        cleanContent.includes('from django') ||
        cleanContent.includes('import django')
    ) {
        return 'Django';
    }

    // Flask detection
    if (
        cleanContent.includes('from flask') ||
        cleanContent.includes('import flask')
    ) {
        return 'Flask';
    }

    // Spring Boot detection
    if (
        cleanContent.includes('@springbootapplication') ||
        cleanContent.includes('import org.springframework')
    ) {
        return 'Spring Boot';
    }

    // Ruby on Rails detection
    if (
        cleanContent.includes('class') &&
        cleanContent.includes('< applicationcontroller')
    ) {
        return 'Ruby on Rails';
    }

    // Laravel detection
    if (
        cleanContent.includes('use illuminate\\') ||
        cleanContent.includes('namespace app\\')
    ) {
        return 'Laravel';
    }

    return undefined;
}

// ──────────────────────────────────────────────────────────────
// DETECT LIBRARIES/DEPENDENCIES
// ──────────────────────────────────────────────────────────────
export const detectLibraries = (content: string): string[] => {
    const libraries: Set<string> = new Set();
    const cleanContent = content.toLowerCase();

    // State Management
    if (cleanContent.includes('redux')) libraries.add('Redux');
    if (cleanContent.includes('zustand')) libraries.add('Zustand');
    if (cleanContent.includes('mobx')) libraries.add('MobX');
    if (cleanContent.includes('recoil')) libraries.add('Recoil');
    if (cleanContent.includes('jotai')) libraries.add('Jotai');

    // HTTP Clients
    if (cleanContent.includes('axios')) libraries.add('Axios');
    if (cleanContent.includes('fetch(')) libraries.add('Fetch API');

    // Testing
    if (cleanContent.includes('jest')) libraries.add('Jest');
    if (cleanContent.includes('vitest')) libraries.add('Vitest');
    if (cleanContent.includes('mocha')) libraries.add('Mocha');
    if (cleanContent.includes('chai')) libraries.add('Chai');
    if (cleanContent.includes('pytest')) libraries.add('Pytest');
    if (cleanContent.includes('@testing-library')) libraries.add('Testing Library');

    // ORMs/Database
    if (cleanContent.includes('prisma')) libraries.add('Prisma');
    if (cleanContent.includes('typeorm')) libraries.add('TypeORM');
    if (cleanContent.includes('sequelize')) libraries.add('Sequelize');
    if (cleanContent.includes('mongoose')) libraries.add('Mongoose');
    if (cleanContent.includes('sqlalchemy')) libraries.add('SQLAlchemy');

    // UI Libraries
    if (cleanContent.includes('material-ui') || cleanContent.includes('@mui/')) {
        libraries.add('Material-UI');
    }
    if (cleanContent.includes('tailwind')) libraries.add('Tailwind CSS');
    if (cleanContent.includes('styled-components')) libraries.add('Styled Components');
    if (cleanContent.includes('emotion')) libraries.add('Emotion');

    // Validation
    if (cleanContent.includes('zod')) libraries.add('Zod');
    if (cleanContent.includes('yup')) libraries.add('Yup');
    if (cleanContent.includes('joi')) libraries.add('Joi');

    // Form Libraries
    if (cleanContent.includes('react-hook-form')) libraries.add('React Hook Form');
    if (cleanContent.includes('formik')) libraries.add('Formik');

    return Array.from(libraries);
}

// ──────────────────────────────────────────────────────────────
// DETECT DATABASE TYPE
// ──────────────────────────────────────────────────────────────
export const detectDatabase = (content: string): string | undefined => {
    const cleanContent = content.toLowerCase();

    if (cleanContent.includes('postgresql') || cleanContent.includes('pg.')) {
        return 'PostgreSQL';
    }
    if (cleanContent.includes('mysql')) {
        return 'MySQL';
    }
    if (cleanContent.includes('mongodb') || cleanContent.includes('mongoose')) {
        return 'MongoDB';
    }
    if (cleanContent.includes('redis')) {
        return 'Redis';
    }
    if (cleanContent.includes('sqlite')) {
        return 'SQLite';
    }
    if (cleanContent.includes('dynamodb')) {
        return 'DynamoDB';
    }
    if (cleanContent.includes('firebase')) {
        return 'Firebase';
    }

    return undefined;
}

// ──────────────────────────────────────────────────────────────
// DETECT ARCHITECTURE PATTERN
// ──────────────────────────────────────────────────────────────
export const detectArchitecture = (filename: string, content: string): string | undefined => {
    const cleanContent = content.toLowerCase();
    const path = filename.toLowerCase();

    // MVC
    if (
        path.includes('/controllers/') ||
        path.includes('/models/') ||
        path.includes('/views/')
    ) {
        return 'MVC';
    }

    // Clean Architecture / Hexagonal
    if (
        path.includes('/domain/') &&
        path.includes('/application/') &&
        path.includes('/infrastructure/')
    ) {
        return 'Clean Architecture';
    }

    // Layered Architecture
    if (
        path.includes('/services/') ||
        path.includes('/repositories/') ||
        path.includes('/controllers/')
    ) {
        return 'Layered Architecture';
    }

    // Microservices indicators
    if (
        cleanContent.includes('grpc') ||
        cleanContent.includes('kafka') ||
        cleanContent.includes('rabbitmq')
    ) {
        return 'Microservices';
    }

    return undefined;
}

// ──────────────────────────────────────────────────────────────
// DETECT TEST FRAMEWORK
// ──────────────────────────────────────────────────────────────
export const detectTestFramework = (content: string, filename: string): string | undefined => {
    if (!/\.(test|spec)\.(ts|js|tsx|jsx|py)$/.test(filename)) {
        return undefined;
    }

    const cleanContent = content.toLowerCase();

    if (cleanContent.includes('describe(') && cleanContent.includes('it(')) {
        if (cleanContent.includes('jest')) return 'Jest';
        if (cleanContent.includes('mocha')) return 'Mocha';
        if (cleanContent.includes('vitest')) return 'Vitest';
        return 'Jest/Mocha'; // Default assumption
    }

    if (cleanContent.includes('pytest') || cleanContent.includes('def test_')) {
        return 'Pytest';
    }

    if (cleanContent.includes('unittest') && cleanContent.includes('python')) {
        return 'unittest';
    }

    if (cleanContent.includes('@test') && cleanContent.includes('java')) {
        return 'JUnit';
    }

    return undefined;
}

// ──────────────────────────────────────────────────────────────
// DETECT BUILD TOOL
// ──────────────────────────────────────────────────────────────
export const detectBuildTool = (allFilenames: string[]): string | undefined => {
    const files = allFilenames.map(f => f.toLowerCase());

    if (files.some(f => f.includes('package.json'))) {
        if (files.some(f => f.includes('pnpm-lock.yaml'))) return 'pnpm';
        if (files.some(f => f.includes('yarn.lock'))) return 'Yarn';
        return 'npm';
    }

    if (files.some(f => f.includes('requirements.txt') || f.includes('pyproject.toml'))) {
        return 'pip/Poetry';
    }

    if (files.some(f => f.includes('pom.xml'))) return 'Maven';
    if (files.some(f => f.includes('build.gradle'))) return 'Gradle';
    if (files.some(f => f.includes('cargo.toml'))) return 'Cargo';
    if (files.some(f => f.includes('go.mod'))) return 'Go Modules';

    return undefined;
}

// ──────────────────────────────────────────────────────────────
// MAIN CONTEXT DETECTION FUNCTION
// ──────────────────────────────────────────────────────────────
export const detectProjectContext = (
    filename: string,
    content: string,
    allFilenames: string[] = []
): ProjectContext => {
    const language = getFileType(filename);
    const framework = detectFrameworkFromCode(content, filename);
    const libraries = detectLibraries(content);
    const database = detectDatabase(content);
    const architecture = detectArchitecture(filename, content);
    const testFramework = detectTestFramework(content, filename);
    const buildTool = detectBuildTool(allFilenames);

    return {
        language,
        framework,
        libraries,
        database,
        architecture,
        testFramework,
        buildTool,
    };
}

// ──────────────────────────────────────────────────────────────
// GENERATE CONTEXT PROMPT FOR LLM
// ──────────────────────────────────────────────────────────────
export const generateContextPrompt = (context: ProjectContext): string => {
    const parts: string[] = [];

    parts.push(`Language: ${context.language}`);

    if (context.framework) {
        parts.push(`Framework: ${context.framework}`);
    }

    if (context.libraries.length > 0) {
        parts.push(`Libraries: ${context.libraries.join(', ')}`);
    }

    if (context.database) {
        parts.push(`Database: ${context.database}`);
    }

    if (context.architecture) {
        parts.push(`Architecture: ${context.architecture}`);
    }

    if (context.testFramework) {
        parts.push(`Test Framework: ${context.testFramework}`);
    }

    if (context.buildTool) {
        parts.push(`Build Tool: ${context.buildTool}`);
    }

    return parts.join('\n');
}

// ──────────────────────────────────────────────────────────────
// AGGREGATE CONTEXT FROM MULTIPLE FILES
// ──────────────────────────────────────────────────────────────
export const aggregateProjectContext = (chunks: Chunk[]): ProjectContext => {
    const allFilenames = chunks.map(c => c.filename).filter((f): f is string => typeof f === 'string');
    const contexts = chunks.map(chunk =>
        detectProjectContext(chunk.filename || '', chunk.content, allFilenames)
    );

    // Find most common language
    const languages = contexts.map(c => c.language);
    const language = getMostCommon(languages) ?? '';

    // Find framework (prefer non-undefined values)
    const frameworks = contexts.map(c => c.framework).filter(Boolean) as string[];
    const framework = getMostCommon(frameworks);

    // Merge all libraries (unique)
    const libraries = [...new Set(contexts.flatMap(c => c.libraries))];

    // Find database
    const databases = contexts.map(c => c.database).filter(Boolean) as string[];
    const database = getMostCommon(databases);

    // Find architecture
    const architectures = contexts.map(c => c.architecture).filter(Boolean) as string[];
    const architecture = getMostCommon(architectures);

    // Find test framework
    const testFrameworks = contexts.map(c => c.testFramework).filter(Boolean) as string[];
    const testFramework = getMostCommon(testFrameworks);

    // Detect build tool from all filenames
    const buildTool = detectBuildTool(allFilenames);

    return {
        language,
        framework,
        libraries,
        database,
        architecture,
        testFramework,
        buildTool,
    };
}

