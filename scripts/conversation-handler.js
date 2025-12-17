import { Octokit } from '@octokit/rest';
import { readFileSync, writeFileSync } from "fs";

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

async function main() {
    console.log('AI Conversation Handler Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const eventName = process.env.GITHUB_EVENT_NAME;
    const eventPath = process.env.GITHUB_EVENT_PATH;

    const event = JSON.parse(readFileSync(eventPath, 'utf8'));

    console.log(`Event type: ${eventName}`);
    console.log(`Comment ID: ${event.comment?.id}`);

    let commentContext;

    if (eventName === 'pull_request_review_comment') {
        commentContext = await handleInlineComment(event);
    } else if (eventName === 'issue_comment') {
        commentContext = await handleGeneralComment(event);
    } else {
        console.log('Unsupported event type');
        process.exit(1);
    }

    // Enrich with full context for LLM
    const enrichedContext = await enrichContextForLLM(commentContext);

    console.log('\nEnriched Context Summary:');
    console.log(`  Thread messages: ${enrichedContext.thread.length}`);
    console.log(`  File: ${enrichedContext.codeContext.filePath}`);
    console.log(`  Diff lines: ${enrichedContext.codeContext.diffLines?.length || 0}`);
    console.log(`  Surrounding context lines: ${enrichedContext.codeContext.surroundingLines?.length || 0}`);

    // Save for backend API
    writeFileSync('llm-context.json', JSON.stringify(enrichedContext, null, 2));
    console.log('Full context saved to llm-context.json');
}

async function handleInlineComment(event) {
    console.log('\nProcessing inline comment...');

    const comment = event.comment;
    const pr = event.pull_request;

    if (!comment.in_reply_to_id) {
        console.log('Not a reply - AI only responds to questions about its reviews');
        process.exit(0);
    }

    const context = {
        type: 'inline',
        commentId: comment.id,
        prNumber: pr.number,
        filePath: comment.path,
        line: comment.line || comment.original_line,
        originalLine: comment.original_line,
        diffHunk: comment.diff_hunk,
        currentQuestion: {
            body: comment.body,
            author: comment.user.login,
            createdAt: comment.created_at,
        },
        inReplyTo: comment.in_reply_to_id,
        commitId: comment.commit_id,
    };

    console.log(`  File: ${context.filePath}`);
    console.log(`  Line: ${context.line}`);

    // Fetch thread
    const threadData = await fetchCommentThread(context.inReplyTo, pr.number);

    if (!threadData.rootComment.isAI) {
        console.log('Root comment not from AI - skipping');
        process.exit(0);
    }

    context.thread = threadData.thread;
    context.rootComment = threadData.rootComment;

    console.log('Valid thread with AI root comment');

    return context;
}

async function handleGeneralComment(event) {
    console.log('\nProcessing general PR comment...');

    const comment = event.comment;
    const issue = event.issue;

    const { data: pr } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: issue.number
    });

    return {
        type: 'general',
        commentId: comment.id,
        prNumber: issue.number,
        currentQuestion: {
            body: comment.body,
            author: comment.user.login,
            createdAt: comment.created_at,
        },
        filePath: null,
        line: null,
    };
}

async function fetchCommentThread(rootCommentId, prNumber) {
    console.log(`  Fetching thread from comment ${rootCommentId}...`);

    const { data: allComments } = await octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100
    });

    const rootComment = allComments.find(c => c.id === rootCommentId);

    if (!rootComment) {
        return { thread: [], rootComment: null };
    }

    const isAIComment = rootComment.user.type === 'Bot' ||
        rootComment.user.login.includes('[bot]') ||
        rootComment.user.login.includes('github-actions');

    const thread = buildThreadTree(rootComment, allComments);

    console.log(`  Found ${thread.length} messages in thread`);

    return {
        thread,
        rootComment: {
            id: rootComment.id,
            author: rootComment.user.login,
            body: rootComment.body,
            isAI: isAIComment,
            filePath: rootComment.path,
            line: rootComment.line,
            originalLine: rootComment.original_line,
            diffHunk: rootComment.diff_hunk,
            commitId: rootComment.commit_id,
            createdAt: rootComment.created_at,
        }
    };
}

function buildThreadTree(rootComment, allComments) {
    const thread = [{
        id: rootComment.id,
        author: rootComment.user.login,
        body: rootComment.body,
        createdAt: rootComment.created_at,
        isAI: rootComment.user.type === 'Bot' || rootComment.user.login.includes('[bot]'),
    }];

    // Recursive function to add all replies
    function addReplies(parentId) {
        const replies = allComments
            .filter(c => c.in_reply_to_id === parentId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        for (const reply of replies) {
            thread.push({
                id: reply.id,
                author: reply.user.login,
                body: reply.body,
                createdAt: reply.created_at,
                isAI: reply.user.type === 'Bot' || reply.user.login.includes('[bot]'),
            });

            // Recursively add nested replies
            addReplies(reply.id);
        }
    }

    addReplies(rootComment.id);

    return thread;
}

// ============================================
// ENRICH CONTEXT FOR LLM
// ============================================

async function enrichContextForLLM(baseContext) {
    console.log('\n Enriching context for LLM...');

    const enriched = {
        // Original conversation data
        conversationContext: {
            prNumber: baseContext.prNumber,
            commentId: baseContext.commentId,
            type: baseContext.type,
            currentQuestion: baseContext.currentQuestion,
            thread: baseContext.thread,
            rootComment: baseContext.rootComment,
        },

        // Code context (what we're discussing)
        codeContext: null,

        // PR context (broader picture)
        prContext: null,
    };

    // Only fetch code context for inline comments
    if (baseContext.type === 'inline' && baseContext.filePath) {
        enriched.codeContext = await fetchCodeContext(
            baseContext.prNumber,
            baseContext.filePath,
            baseContext.line,
            baseContext.diffHunk,
            baseContext.commitId
        );
    }

    // Fetch PR context
    enriched.prContext = await fetchPRContext(baseContext.prNumber);

    return enriched;
}

async function fetchCodeContext(prNumber, filePath, line, diffHunk, commitId) {
    console.log('Fetching code context...');
    console.log(`File: ${filePath}, Line: ${line}`);

    try {
        // 1. Parse the diff hunk to get changed lines
        const diffLines = parseDiffHunk(diffHunk);

        // 2. Get the full file content from the PR head
        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber
        });

        let fileContent = null;
        let surroundingLines = null;

        try {
            // Try to get file content
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: filePath,
                ref: pr.head.sha
            });

            if (fileData.content) {
                // Decode base64 content
                fileContent = Buffer.from(fileData.content, 'base64').toString('utf8');

                // Extract surrounding lines (±10 lines around the changed line)
                surroundingLines = extractSurroundingLines(fileContent, line, 10);

                console.log(` Got file content (${fileContent.split('\n').length} lines)`);
                console.log(` Extracted surrounding context (${surroundingLines.length} lines)`);
            }
        } catch (error) {
            console.log(`  Could not fetch file content: ${error.message}`);
            // File might be too large or binary - that's okay
        }

        // 3. Get the PR diff for this file
        const { data: prDiff } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
            mediaType: {
                format: 'diff'
            }
        });

        // Parse the full diff to find this file's changes
        const fileDiff = extractFileDiff(prDiff, filePath);

        console.log('  Code context assembled');

        return {
            filePath,
            language: detectLanguage(filePath),
            targetLine: line,

            // The specific diff hunk where comment was made
            diffHunk: {
                raw: diffHunk,
                parsed: diffLines,
            },

            // Full file diff (all changes in this file)
            fullFileDiff: fileDiff,

            // Surrounding code context
            surroundingLines: surroundingLines,

            // Full file (if available and not too large)
            fullFileContent: fileContent && fileContent.length < 50000 ? fileContent : null,
            fullFileContentTruncated: fileContent && fileContent.length >= 50000,
        };

    } catch (error) {
        console.error(` Error fetching code context: ${error.message}`);
        return {
            filePath,
            error: error.message,
            diffHunk: { raw: diffHunk, parsed: parseDiffHunk(diffHunk) }
        };
    }
}

function parseDiffHunk(diffHunk) {
    if (!diffHunk) return [];

    const lines = diffHunk.split('\n');
    const parsed = [];

    for (const line of lines) {
        if (line.startsWith('@@')) {
            // Header line
            parsed.push({ type: 'header', content: line });
        } else if (line.startsWith('+')) {
            // Added line
            parsed.push({ type: 'added', content: line.substring(1) });
        } else if (line.startsWith('-')) {
            // Removed line
            parsed.push({ type: 'removed', content: line.substring(1) });
        } else if (line.startsWith(' ')) {
            // Context line
            parsed.push({ type: 'context', content: line.substring(1) });
        }
    }

    return parsed;
}

function extractSurroundingLines(fileContent, targetLine, contextSize) {
    const lines = fileContent.split('\n');
    const startLine = Math.max(0, targetLine - contextSize - 1);
    const endLine = Math.min(lines.length, targetLine + contextSize);

    const surrounding = [];
    for (let i = startLine; i < endLine; i++) {
        surrounding.push({
            lineNumber: i + 1,
            content: lines[i],
            isTarget: (i + 1) === targetLine,
        });
    }

    return surrounding;
}

function extractFileDiff(fullDiff, filePath) {
    // Parse full PR diff to find this specific file
    const fileDiffRegex = new RegExp(
        `diff --git a/${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(?=diff --git|$)`,
        'g'
    );

    const match = fileDiffRegex.exec(fullDiff);
    return match ? match[0] : null;
}

function detectLanguage(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const langMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'java': 'java',
        'go': 'go',
        'rb': 'ruby',
        'php': 'php',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'rs': 'rust',
        'kt': 'kotlin',
        'swift': 'swift',
    };
    return langMap[ext] || ext;
}

async function fetchPRContext(prNumber) {
    console.log(' Fetching PR context...');

    try {
        const { data: pr } = await octokit.pulls.get({
            owner,
            repo,
            pull_number: prNumber
        });

        // Get PR files (what files changed)
        const { data: files } = await octokit.pulls.listFiles({
            owner,
            repo,
            pull_number: prNumber
        });

        console.log(`PR has ${files.length} changed files`);

        return {
            title: pr.title,
            description: pr.body,
            state: pr.state,
            author: pr.user.login,
            baseBranch: pr.base.ref,
            headBranch: pr.head.ref,
            changedFiles: files.map(f => ({
                path: f.filename,
                status: f.status,
                additions: f.additions,
                deletions: f.deletions,
                changes: f.changes,
            })),
            totalAdditions: pr.additions,
            totalDeletions: pr.deletions,
            commits: pr.commits,
        };

    } catch (error) {
        console.error(`Error fetching PR context: ${error.message}`);
        return null;
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});