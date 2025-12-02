/**
 * Post AI code review comments to GitHub PR
 * Usage: node post-review.js <review-file-path>
 */

import fs from "fs";
import github from "@actions/github";

async function main() {
    try {
        // Get inputs
        const reviewFilePath = process.argv[2] || 'review.json';
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error('GITHUB_TOKEN environment variable is required');
        }

        // Initialize Octokit
        const octokit = github.getOctokit(token);
        const context = github.context;

        // Read review file
        const reviewContent = fs.readFileSync(reviewFilePath, 'utf8').trim();

        if (!reviewContent) {
            console.log('No review content found');
            return;
        }
        let reviews;
        // Parse reviews
        try {
            // Make sure the reviewContent is JSON safe
            // const sanitized = reviewContent.replace(/```(json|diff)?/g, '').trim()
            reviews = JSON.parse(reviewContent);

            // Validate structure
            if (!Array.isArray(reviews['findings'])) {
                throw new Error('Reviews must be an array');
            }

            console.log(`Parsed ${reviews['summary']?.totalIssues} review chunks`);
        } catch (e) {
            console.error('Failed to parse review file as JSON:', e.message);
            console.error('Content preview:', reviewContent.substring(0, 500));
            console.error('Content type:', typeof reviewContent);

            throw e;
        }

        // Get PR number
        const pr_number = context.payload.pull_request?.number || context.payload.issue?.number;

        if (!pr_number) {
            throw new Error('Could not determine PR number from context');
        }

        console.log(`\nPosting reviews for PR #${pr_number}`);

        // Get the latest commit SHA
        const { data: pr } = await octokit.rest.pulls.get({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: pr_number
        });

        const commit_id = pr.head.sha;
        console.log(`Using commit: ${commit_id}\n`);

        // Track statistics
        let commentCount = 0;
        let errorCount = 0;
        const failedComments = [];

        // Post comments for each file
        for (const chunk of reviews['findings']) {
            const filename = chunk.file;
            console.log(`Processing file: ${filename}`);

            if (!chunk.issues || chunk.issues.length === 0) {
                console.log(`No issues found for this file`);
                continue;
            }

            for (const issue of chunk.issues) {
                const categoryType = issue.type || 'general';
                // Skip if no line number
                if (!issue.lineStart) {
                    console.log(`Skipping issue (no lineStart): ${issue.description?.substring(0, 50)}...`);
                    continue;
                }

                // Format comment body
                const commentBody = formatComment(categoryType, issue);

                try {
                    // Attempt to post line-specific comment
                    await octokit.rest.pulls.createReviewComment({
                        owner: context.repo.owner,
                        repo: context.repo.repo,
                        pull_number: pr_number,
                        commit_id: commit_id,
                        path: filename,
                        line: issue.lineStart,
                        side: "RIGHT",
                        body: commentBody
                    });

                    commentCount++;
                    console.log(`Posted comment at line ${issue.lineStart}`);

                } catch (error) {
                    errorCount++;
                    console.error(`Failed to post comment at line ${issue.lineStart}: ${error.message}`);

                    // Store failed comment for fallback
                    failedComments.push({
                        filename,
                        line: issue.lineStart,
                        body: commentBody,
                        error: error.message
                    });

                    // If it's a validation error (line not in diff), try posting as general comment
                    if (error.status === 422) {
                        try {
                            await octokit.rest.issues.createComment({
                                owner: context.repo.owner,
                                repo: context.repo.repo,
                                issue_number: pr_number,
                                body: `**${filename}** (around line ${issue.lineStart})\n\n${commentBody}`
                            });
                            console.log(`Posted as general comment instead`);
                            commentCount++;
                        } catch (fallbackError) {
                            console.error(`Fallback also failed: ${fallbackError.message}`);
                        }
                    }
                }
            }
        }

        // Print summary
        console.log(`\n${'='.repeat(50)}`);
        console.log(`SUMMARY`);
        console.log(`${'='.repeat(50)}`);
        console.log(`Comments posted: ${commentCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Files reviewed: ${reviews['summary']?.totalIssues}`);

        // Post summary comment to PR
        if (commentCount > 0) {
            const summaryBody = generateSummaryComment(reviews, commentCount, errorCount);

            await octokit.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: pr_number,
                body: summaryBody
            });

            console.log(`\nPosted summary comment to PR`);
        } else {
            console.log(`\nNo issues found - clean code!`);

            await octokit.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: pr_number,
                body: `##AI Code Review\n\n✨ No significant issues found! Code looks good. 👍`
            });
        }

        // Log failed comments for debugging
        if (failedComments.length > 0) {
            console.log(`\nFailed Comments (${failedComments.length}):`);
            failedComments.forEach(fc => {
                console.log(`  - ${fc.filename}:${fc.line} - ${fc.error}`);
            });
        }

        console.log(`\nReview posting completed!`);

    } catch (error) {
        console.error('\nFatal error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

/**
 * Format a comment for GitHub
 */
function formatComment(categoryType, issue) {
    const severityBadge = getSeverityBadge(issue.severity);

    return `**[${categoryType.toUpperCase()}]** ${issue.type || 'Issue'}

${issue.description}

**Recommendation:** ${issue.recommendation}

**${severityBadge} Severity:** \`${issue.severity || 'medium'}\``;
}

/**
 * Get badge emoji for severity
 */
function getSeverityBadge(severity) {
    const badges = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
    };
    return badges[severity?.toLowerCase()] || '🔵';
}

/**
 * Generate summary comment
 */
function generateSummaryComment(reviews, commentCount, errorCount) {
    // Count issues by severity
    const summary = reviews['summary'];
    const categoryCounts = {};

    for (const issue of reviews['findings']) {
        const categoryType = issue.category || 'general';
        categoryCounts[categoryType] = categoryCounts[categoryType] ? categoryCounts[categoryType] + 1 : 1;
    }

    // Build summary
    let reviewSummary = `##AI Code Review Summary\n\n`;
    reviewSummary += `**Overview:**\n`;
    reviewSummary += `- Files reviewed: ${summary['totalFilesReviewed']}\n`;
    reviewSummary += `- Total issues found: ${commentCount}\n`;

    if (errorCount > 0) {
        reviewSummary += `- Failed comments: ${errorCount}\n`;
    }

    reviewSummary += `\n### Severity Breakdown\n`;
    if (summary.critical > 0) reviewSummary += `- 🔴 **Critical:** ${summary.critical}\n`;
    if (summary.high > 0) reviewSummary += `- 🟠 **High:** ${summary.high}\n`;
    if (summary.medium > 0) reviewSummary += `- 🟡 **Medium:** ${summary.medium}\n`;
    if (summary.low > 0) reviewSummary += `- 🟢 **Low:** ${summary.low}\n`;

    if (Object.keys(categoryCounts).length > 0) {
        reviewSummary += `\n### Issues by Category\n`;
        Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, count]) => {
                reviewSummary += `- **${cat}:** ${count}\n`;
            });
    }

    if (severityCounts.critical > 0 || severityCounts.high > 0) {
        reviewSummary += `\n**Action Required:** Please address critical and high severity issues before merging.`;
    } else {
        reviewSummary += `\n**Good to go!** No critical or high severity issues found.`;
    }

    return reviewSummary;
}

// Run the script
main();