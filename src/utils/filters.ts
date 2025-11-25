// Simple changes that don't need deep review
export const SIMPLE_CHANGE_THRESHOLD = {
    MAX_LINES: 5,           // Less than 5 lines changed
    MAX_ADDITIONS: 3,       // Less than 3 additions
    MAX_DELETIONS: 3,       // Less than 3 deletions
};

// Token limits for chunking (to avoid API limits)
export const MAX_CHUNK_TOKENS = 6000; // Leave room for prompt + response

// Files/patterns to skip entirely (no review needed)
// Only JS specific (For now)
export const SKIP_PATTERNS = [
    /\.test\.(ts|js|tsx|jsx)$/,           // Test files
    /\.spec\.(ts|js|tsx|jsx)$/,           // Spec files
    /\.(md|txt|csv)$/,                     // Documentation
    /package(-lock)?\.json$/,              // Package files
    /pnpm-lock\.yaml$/,                    // Lock files
    /yarn\.lock$/,                         // Lock files
    /tsconfig.*\.json$/,                   // TS config
    /\.(gitignore|gitattributes|editorconfig)$/, // Git files
    /\.min\.(js|css)$/,                    // Minified files
    /\.map$/,                              // Source maps
    /dist\//,                              // Build output
    /build\//,                             // Build output
    /node_modules\//,                      // Dependencies
];