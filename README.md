# Agentic AI Code Reviewer

🤖 **AI-powered Multi-agent code reviewer using LangGraph Agents**

Automatically review your pull requests with intelligent code analysis across multiple dimensions. No API keys required - uses GitHub OIDC for secure authentication.

---

## ✨ Features

- 🤖 **Automatic Code Review** - Triggered on every PR creation or manually via comment
- 🔐 **GitHub OIDC Authentication** - No API keys needed, secure by default
- 🚀 **Fast & Efficient** - Incremental or full PR review modes
- 💰 **Free for All** - Available to every GitHub user
- 📊 **Multi-Dimensional Analysis** - Reviews across 6+ dimensions:
  - 🏗️ **Architecture** - Design patterns and structure
  - 🎯 **Idiomatic** - Language best practices
  - ⚡ **Performance** - Optimization opportunities
  - 📖 **Readability** - Code clarity and maintainability
  - 🔒 **Security** - Vulnerability detection
  - ✅ **Testing** - Test coverage and quality

---

## 🚀 Quick Start

### Basic Setup

Add this to your GitHub workflow:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      id-token: write      # Required for OIDC
      contents: read
      pull-requests: read
      issues: write        # For posting comments
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # Full history for diff comparison

      - uses: TusharRoy23/ai-code-reviewer@v0.0.1
        with:
          trigger-phrase: "@ai-code-reviewer review"
          review-mode: "incremental"
```

### Usage Modes

#### 1️⃣ Automatic Review (Recommended)
Reviews run automatically on every PR:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
```

#### 2️⃣ Manual Trigger via Comment
Comment on PR with trigger phrase to review on demand:
```
@ai-code-reviewer review
```

---

## ⚙️ Configuration

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `trigger-phrase` | Keyword to manually trigger review | `@ai-code-reviewer review` | ❌ No |
| `review-mode` | `incremental` (latest commit) or `full` (entire PR) | `incremental` | ❌ No |

### Review Modes

**Incremental Mode** (default):
- Reviews only the latest commit
- Faster, lower token usage
- Best for active development

**Full Mode**:
- Reviews entire PR
- Comprehensive analysis
- Slightly slower

```yaml
- uses: TusharRoy23/ai-code-reviewer@v0.0.1
  with:
    review-mode: "full"  # Or "incremental"
```

---

## 🔐 Security & Authentication

### How It Works

1. GitHub Actions automatically provides an **OIDC token**
2. Action includes token in request to backend
3. Backend verifies token signature with GitHub's public keys
4. Request is authenticated and authorized
5. Review is processed and results posted to PR

### No API Keys Needed!

✅ Users don't manage secrets  
✅ Tokens are short-lived (~15 minutes)  
✅ Each token is repository-specific  
✅ All requests are auditable  

### Required Permissions

```yaml
permissions:
  id-token: write        # For OIDC token generation
  contents: read         # To read code
  pull-requests: read    # To read PR data
  issues: write          # To post comments
```

---

## 📊 Review Analysis

The action analyzes code across six key dimensions:

### 🏗️ Architecture
- Design patterns
- Code organization
- Component structure
- Separation of concerns

### 🎯 Idiomatic
- Language best practices
- Framework conventions
- Style guides compliance
- Naming conventions

### ⚡ Performance
- Algorithmic efficiency
- Resource usage
- Query optimization
- Caching opportunities

### 📖 Readability
- Code clarity
- Comments quality
- Variable naming
- Function complexity

### 🔒 Security
- Vulnerability detection
- Authentication/authorization
- Input validation
- Sensitive data handling

### ✅ Testing
- Test coverage
- Test quality
- Edge cases
- Mocking practices

---

## 📈 Review Output

Each review includes:

- **Severity Level** - Critical, High, Medium, Low
- **Issue Type** - Category of issue found
- **Description** - What's the problem
- **Recommendation** - How to fix it
- **Line Numbers** - Exact location in code
- **File Path** - Which file is affected

Comments are posted directly to your PR with line-specific feedback.

---

## 💡 Examples

### Example 1: Automatic Review on PR

```
User opens PR with new feature
  ↓
GitHub Actions triggers automatically
  ↓
Agentic AI Code Reviewer posts review comments
  ↓
User can see suggestions on code diff
  ↓
User can address issues before merge
```

### Example 2: Manual Trigger

```
User wants review on specific commit
  ↓
User comments: "@ai-code-reviewer review"
  ↓
Action processes the PR
  ↓
Review posted to PR
```

---

## 🛡️ Limits & Protection

To protect against abuse, the action includes:

- ⏰ Max diff size: **150 KB** per review
- 📊 Rate limiting: **30 reviews per 15 minutes** per repository
- 🔍 File filtering: Only reviews code files (TypeScript, Python, Java, etc.)
- ⏭️ Auto-skips: Lock files, minified code, config files

---

## 🚨 Troubleshooting

### Review not running?

1. ✅ Check `permissions: { id-token: write }` is set
2. ✅ Verify `fetch-depth: 0` in checkout step
3. ✅ Check workflow trigger events (PR or issue_comment)
4. ✅ Ensure action is using latest version `@v1`

### No comments appearing?

1. ✅ Check `permissions: { issues: write }` is set
2. ✅ Verify PR diff is not larger than 150 KB
3. ✅ Check if diff contains code files (not just docs/config)

### Getting authentication errors?

1. ✅ Ensure `id-token: write` permission is present
2. ✅ Check repo has GitHub Actions enabled
3. ✅ Verify workflow file is valid YAML

---

## 📝 Supported Languages

The action reviews code in:

- TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)
- Python (`.py`)
- Java (`.java`)
- Go (`.go`)
- C/C++ (`.c`, `.cpp`)
- Ruby (`.rb`)
- PHP (`.php`)
- Swift (`.swift`)
- Rust (`.rs`)
- Kotlin (`.kt`)
- Scala (`.scala`)
- C# (`.cs`)
- HTML/CSS (`.html`, `.css`, `.scss`)
- Vue/Svelte (`.vue`, `.svelte`)

---

## 🤝 Contributing

Found a bug or have a feature request?

- 📧 [Open an Issue](../../issues)
- 🍴 [Submit a PR](../../pulls)

---

## 📞 Support

- **Documentation**: Check the [README](README.md)
- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)

---

## 🌟 Show Your Support

If you find this action helpful, please consider:

- ⭐ Starring the repository
- 📢 Sharing with your team
- 💬 Providing feedback

---

**Made with ❤️ by [TusharRoy23](https://github.com/TusharRoy23)**