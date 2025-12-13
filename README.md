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
      id-token: write
      contents: write
      pull-requests: write
      issues: write
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 

      - uses: TusharRoy23/ai-code-reviewer@v0.0.5
        with:
          trigger-phrase: "@ai-code-reviewer review"
          review-mode: "incremental"
          llm: ${{ secrets.LLM }}
          llm-api-key: ${{ secrets.LLM_API_KEY }}
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

#### 2️⃣ Run query on provided LLM
Pass your own LLM & API_KEY via GitHub Repository Secrets:
```
llm: ${{ secrets.LLM }}
llm-api-key: ${{ secrets.LLM_API_KEY }}
```

---

## ⚙️ Configuration

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `trigger-phrase` | Keyword to manually trigger review | `@ai-code-reviewer review` | ❌ No |
| `review-mode` | `incremental` (latest commit) or `full` (entire PR) | `incremental` | ❌ No |
| `llm` | `deepseek-coder`, `gpt-4o-mini`, etc. | `gpt-4o-mini` | ✅ Yes |
| `llm-api-key` | API KEY for LLM call | | ✅ Yes |

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
- uses: TusharRoy23/ai-code-reviewer@v0.0.5
  with:
    review-mode: "incremental"  # Or "full"
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
  id-token: write         # OIDC Auth - Securely call your backend without API keys
  contents: write         # Repo contents (files) - Generate diffs or potentially write outputs
  pull-requests: write    # To read PR data - Post review comments or approvals
  issues: write           # To post comments - Respond to trigger comments in PRs or issues
```

---

## 📊 Review Analysis

The action analyzes code across six key dimensions:

### 👥 Coordinator
- Decide agents need
- Return planned prompt
- Agent Selection

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

### 🪲 Bug
- Logical Errors
- State & Data Mutations
- Async / Concurrency Bugs
- Error Handling Failures & more

### 🧪 Testing
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
4. ✅ Ensure action is using latest version `@v6`

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

- 📧 [Open an Issue](https://github.com/TusharRoy23/ai-code-reviewer/issues)
- 🍴 [Submit a PR](https://github.com/TusharRoy23/ai-code-reviewer/pulls)

---

## 🌟 Show Your Support

If you find this action helpful, please consider:

- ⭐ Starring the repository
- 📢 Sharing with your team
- 💬 Providing feedback

---
## 📞  Stay in Touch
- 📖 Read My Stories - [Medium](https://medium.com/@tushar-chy)
- 🔗 Connect on - [LinkedIn](https://www.linkedin.com/in/tushar-roy-chy/)
- 📫 Email Me - [chowdhurytusharroy@gmail.com](mailto:chowdhurytusharroy@gmail.com?subject=Hey%20there)

---
**Made with ❤️ by [TusharRoy23](https://github.com/TusharRoy23)**