// Simple changes that don't need deep review
export const SIMPLE_CHANGE_THRESHOLD = {
    MAX_LINES: 5,           // Less than 5 lines changed
    MAX_ADDITIONS: 3,       // Less than 3 additions
    MAX_DELETIONS: 3,       // Less than 3 deletions
};

// Token limits for chunking (to avoid API limits)
export const MAX_CHUNK_TOKENS = 6000;

// Files/patterns to skip entirely (no review needed)
export const SKIP_PATTERNS = [
    // ---- JS/TS ----
    /\.test\.(ts|js|tsx|jsx)$/,
    /\.spec\.(ts|js|tsx|jsx)$/,
    /\.(md|txt|csv|rst)$/,
    /package(-lock)?\.json$/,
    /pnpm-lock\.yaml$/,
    /yarn\.lock$/,
    /tsconfig.*\.json$/,
    /\.min\.(js|css)$/,
    /\.map$/,
    /dist\//,
    /build\//,
    /node_modules\//,

    // ---- Python ----
    /__pycache__\//,
    /\.pyc$/,
    /\.pyo$/,
    /requirements(-dev)?\.txt$/,
    /poetry\.lock$/,
    /Pipfile(\.lock)?$/,
    /setup\.py$/,
    /venv\//,
    /env\//,

    // ---- Java / Kotlin ----
    /target\//,
    /build\//,
    /\.class$/,
    /\.jar$/,
    /\.war$/,
    /\.ear$/,
    /pom\.xml$/,
    /gradle\.properties$/,
    /gradlew(\.bat)?$/,

    // ---- Go ----
    /go\.mod$/,
    /go\.sum$/,
    /vendor\//,
    /\.exe$/, // from go builds
    /bin\//,

    // ---- PHP / Laravel ----
    /vendor\//,
    /composer\.lock$/,
    /\.blade\.php$/, // templates (not code review target usually)
    /storage\//,
    /bootstrap\/cache\//,

    // ---- Ruby / Rails ----
    /Gemfile(\.lock)?$/,
    /tmp\//,
    /log\//,
    /vendor\//,
    /db\/schema\.rb/,

    // ---- Rust ----
    /Cargo\.lock$/,
    /target\//,

    // ---- C# / .NET ----
    /bin\//,
    /obj\//,
    /\.csproj$/,
    /\.sln$/,

    // ---- C/C++ ----
    /\.o$/,
    /\.so$/,
    /\.dll$/,
    /build\//,
    /CMakeCache\.txt/,
    /CMakeFiles\//,

    // ---- Frontend frameworks ----
    /\.next\//,     // Next.js build
    /\.nuxt\//,     // Nuxt build
    /out\//,        // Next.js static output
    /public\//,     // Next, Laravel, Nuxt public assets
    /coverage\//,
    /storybook-static\//,

    // ---- Mobile ----
    /android\/build\//,
    /ios\/build\//,
    /ios\/Pods\//,

    // ---- Docker / CI ----
    /Dockerfile$/,
    /docker-compose\.ya?ml$/,
    /\.github\/workflows\//, // you may or may not skip CI files

    // ---- General binary / artifacts ----
    /\.zip$/,
    /\.tar\.gz$/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.svg$/,
    /\.ico$/,
    /\.pdf$/,
];
