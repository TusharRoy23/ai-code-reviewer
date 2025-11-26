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
        jsx: "JavaScript (React likely)",
        ts: "TypeScript",
        tsx: "TypeScript (React likely)",
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
        sh: "Shell Script"
    };

    const detected = new Set();

    for (const ext of Object.keys(extMap)) {
        const files = globSync(`**/*.${ext}`, {
            ignore: ["node_modules/**", "dist/**", "build/**"]
        });

        if (files.length > 0) detected.add(extMap[ext]);
    }

    return Array.from(detected);
}

/** 2. Detect frameworks by scanning files/folders */
function detectFrameworks() {
    const frameworks = new Set();

    const filePatterns = {
        React: ["**/*.jsx", "**/*.tsx"],
        Angular: ["**/*.component.ts", "**/*.module.ts"],
        Vue: ["**/*.vue"],
        NextJS: ["next.config.js", "next.config.mjs", "pages/**", "app/**"],
        Nuxt: ["nuxt.config.ts", "pages/**"],
        Svelte: ["**/*.svelte"],
        Express: ["**/*.js"],
        Django: ["manage.py", "**/settings.py"],
        Flask: ["**/*.py"],
        FastAPI: ["**/*.py"],
    };

    for (const [framework, patterns] of Object.entries(filePatterns)) {
        for (const pat of patterns) {
            if (glob.sync(pat, { ignore: "node_modules/**" }).length > 0) {
                frameworks.add(framework);
                break;
            }
        }
    }

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

        for (const lib of Object.keys(deps || {})) libs.add(lib);
    }

    // Python libs
    if (fs.existsSync("requirements.txt")) {
        const lines = fs.readFileSync("requirements.txt", "utf8").split("\n");
        lines.forEach((line) => {
            const clean = line.trim().split("==")[0];
            if (clean) libs.add(clean);
        });
    }

    if (fs.existsSync("pyproject.toml")) {
        libs.add("Python - pyproject");
    }

    return Array.from(libs);
}

/** 4. Infer project type */
function inferProjectType(langs, frameworks, libs) {
    if (frameworks.includes("Django") || frameworks.includes("Flask") || frameworks.includes("FastAPI"))
        return "backend";

    if (frameworks.includes("Angular") || frameworks.includes("React") || frameworks.includes("Vue"))
        return "frontend";

    if (langs.includes("JavaScript") && langs.includes("Python"))
        return "full-stack";

    if (libs.includes("express"))
        return "backend";

    return "unknown";
}

/** Main entry */
export const detectProjectInfo = () => {
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
if (process.argv[1].includes("detectProjectInfo.js")) {
    console.log(JSON.stringify(detectProjectInfo(), null, 2));
}
