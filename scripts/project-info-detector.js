import fs from "fs";
import { globSync } from "glob";

/** Utility to safely read JSON */
function readJsonSafe(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, "utf8"));
        }
    } catch { }
    return null;
}

/** 1. Detect languages by file extensions */
function detectLanguages() {
    const extMap = {
        js: "JavaScript",
        jsx: "JavaScript",
        ts: "TypeScript",
        tsx: "TypeScript",
        py: "Python",
        php: "PHP",
        go: "Go",
        rb: "Ruby",
        java: "Java",
        cs: "C#",
        vue: "Vue.js",
        svelte: "Svelte",
        html: "HTML",
        css: "CSS",
        scss: "SCSS",
        sql: "SQL",
        sh: "Shell"
    };

    const detected = new Set();

    for (const ext of Object.keys(extMap)) {
        const files = globSync(`**/*.${ext}`, {
            ignore: ["node_modules/**", "dist/**", "build/**", ".git/**"]
        });

        if (files.length > 0) {
            detected.add(extMap[ext]);
        }
    }

    return Array.from(detected);
}

/** 2. Detect frameworks by scanning files/folders */
function detectFrameworks() {
    const frameworks = new Set();

    // Check Next.js
    if (fs.existsSync("next.config.js") || fs.existsSync("next.config.mjs") || fs.existsSync("next.config.ts")) {
        frameworks.add("Next.js");
    }

    // Check Nuxt
    if (fs.existsSync("nuxt.config.ts") || fs.existsSync("nuxt.config.js")) {
        frameworks.add("Nuxt");
    }

    // Check for React (package.json check)
    const pkg = readJsonSafe("package.json");
    if (pkg) {
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (allDeps.react) frameworks.add("React");
        if (allDeps.vue) frameworks.add("Vue");
        if (allDeps["@angular/core"]) frameworks.add("Angular");
        if (allDeps.svelte) frameworks.add("Svelte");
        if (allDeps.express) frameworks.add("Express");
        if (allDeps.nestjs || allDeps["@nestjs/core"]) frameworks.add("NestJS");
    }

    // Check Python frameworks
    const reqFile = fs.existsSync("requirements.txt")
        ? fs.readFileSync("requirements.txt", "utf8")
        : "";

    if (reqFile.includes("django") || fs.existsSync("manage.py")) {
        frameworks.add("Django");
    }
    if (reqFile.includes("flask")) {
        frameworks.add("Flask");
    }
    if (reqFile.includes("fastapi")) {
        frameworks.add("FastAPI");
    }

    // Check for Vue/Svelte files
    const vueFiles = globSync("**/*.vue", { ignore: ["node_modules/**"] });
    if (vueFiles.length > 0) frameworks.add("Vue");

    const svelteFiles = globSync("**/*.svelte", { ignore: ["node_modules/**"] });
    if (svelteFiles.length > 0) frameworks.add("Svelte");

    return Array.from(frameworks);
}

/** 3. Detect libraries from project config files */
function detectLibraries() {
    const libs = new Set();

    const pkg = readJsonSafe("package.json");
    if (pkg) {
        const deps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
        };

        // Only included major libraries, not everything
        const majorLibs = [
            "axios", "lodash", "moment", "date-fns",
            "zustand", "redux", "mobx", "recoil",
            "prisma", "mongoose", "typeorm", "sequelize",
            "jest", "vitest", "mocha", "chai",
            "tailwindcss", "styled-components", "@emotion/react",
            "zod", "yup", "joi",
            "graphql", "apollo", "react-query", "@tanstack/react-query"
        ];

        for (const lib of Object.keys(deps || {})) {
            if (majorLibs.includes(lib)) {
                libs.add(lib);
            }
        }
    }

    // Python libs
    if (fs.existsSync("requirements.txt")) {
        const lines = fs.readFileSync("requirements.txt", "utf8").split("\n");
        const majorPyLibs = ["pandas", "numpy", "sqlalchemy", "pytest", "requests"];

        lines.forEach((line) => {
            const clean = line.trim().split("==")[0].split(">=")[0].split("<=")[0];
            if (clean && majorPyLibs.includes(clean)) {
                libs.add(clean);
            }
        });
    }

    return Array.from(libs);
}

/** 4. Infer project type */
function inferProjectType(langs, frameworks, libs) {
    // Backend frameworks
    if (frameworks.includes("Django") ||
        frameworks.includes("Flask") ||
        frameworks.includes("FastAPI") ||
        frameworks.includes("Express") ||
        frameworks.includes("NestJS")) {
        return "backend";
    }

    // Frontend frameworks
    if (frameworks.includes("Angular") ||
        frameworks.includes("React") ||
        frameworks.includes("Vue") ||
        frameworks.includes("Svelte")) {

        // Check if also has backend
        if (frameworks.includes("Next.js") || frameworks.includes("Nuxt")) {
            return "fullstack";
        }
        return "frontend";
    }

    // Full-stack indicators
    if (langs.includes("JavaScript") && langs.includes("Python")) {
        return "fullstack";
    }

    if (frameworks.includes("Next.js") || frameworks.includes("Nuxt")) {
        return "fullstack";
    }

    return "general";
}

/** Main entry */
export function detectProjectInfo() {
    const languages = detectLanguages();
    const frameworks = detectFrameworks();
    const libraries = detectLibraries();
    const projectType = inferProjectType(languages, frameworks, libraries);

    return {
        languages,
        frameworks,
        libraries,
        projectType,
    };
}

// If run directly from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(JSON.stringify(detectProjectInfo(), null, 2));
}