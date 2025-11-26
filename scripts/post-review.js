/**
 * Post AI code review comments to GitHub PR
 * Usage: node post-review.js <review-file-path>
 */

import fs from "fs";
import github from "@actions/github";

async function main() {
    try {
        // Get inputs
        const reviewFilePath = process.argv[2] || 'review.md';
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
            const sanitized = reviewContent.replace(/```(json|diff)?/g, '').trim()
            reviews = JSON.parse(sanitized);

            // Validate structure
            if (!Array.isArray(reviews)) {
                throw new Error('Reviews must be an array');
            }

            console.log(`📦 Parsed ${reviews.length} review chunks`);
        } catch (e) {
            console.error('❌ Failed to parse review file as JSON:', e.message);
            console.error('Content preview:', reviewContent.substring(0, 500));
            console.error('Content type:', typeof reviewContent);

            // Try to show where parsing failed
            try {
                const lines = reviewContent.split('\n');
                console.error('Total lines:', lines.length);
                console.error('First line:', lines[0]);
                console.error('Last line:', lines[lines.length - 1]);
            } catch { }

            throw e;
        }

        // Get PR number
        const pr_number = context.payload.pull_request?.number || context.payload.issue?.number;

        if (!pr_number) {
            throw new Error('Could not determine PR number from context');
        }

        console.log(`\nPosting reviews for PR #${pr_number}`);
        console.log(`Total files to review: ${reviews.length}`);

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
        for (const chunk of reviews) {
            const filename = chunk.filename;
            console.log(`Processing file: ${filename}`);

            if (!chunk.issues || chunk.issues.length === 0) {
                console.log(`No issues found for this file`);
                continue;
            }

            for (const category of chunk.issues) {
                const categoryType = category.type || 'general';

                if (!category.issues || category.issues.length === 0) {
                    continue;
                }

                console.log(`Category: ${categoryType} (${category.issues.length} issue(s))`);

                for (const issue of category.issues) {
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
        }

        // Print summary
        console.log(`\n${'='.repeat(50)}`);
        console.log(`SUMMARY`);
        console.log(`${'='.repeat(50)}`);
        console.log(`Comments posted: ${commentCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Files reviewed: ${reviews.length}`);

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
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    const categoryCounts = {};

    for (const review of reviews) {
        for (const category of review.issues || []) {
            const categoryType = category.type || 'general';
            categoryCounts[categoryType] = (categoryCounts[categoryType] || 0) + (category.issues?.length || 0);

            for (const issue of category.issues || []) {
                const severity = issue.severity?.toLowerCase() || 'medium';
                severityCounts[severity] = (severityCounts[severity] || 0) + 1;
            }
        }
    }

    // Build summary
    let summary = `##AI Code Review Summary\n\n`;
    summary += `**Overview:**\n`;
    summary += `- Files reviewed: ${reviews.length}\n`;
    summary += `- Total issues found: ${commentCount}\n`;

    if (errorCount > 0) {
        summary += `- Failed comments: ${errorCount}\n`;
    }

    summary += `\n### Severity Breakdown\n`;
    if (severityCounts.critical > 0) summary += `- 🔴 **Critical:** ${severityCounts.critical}\n`;
    if (severityCounts.high > 0) summary += `- 🟠 **High:** ${severityCounts.high}\n`;
    if (severityCounts.medium > 0) summary += `- 🟡 **Medium:** ${severityCounts.medium}\n`;
    if (severityCounts.low > 0) summary += `- 🟢 **Low:** ${severityCounts.low}\n`;

    if (Object.keys(categoryCounts).length > 0) {
        summary += `\n### Issues by Category\n`;
        Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, count]) => {
                summary += `- **${cat}:** ${count}\n`;
            });
    }

    if (severityCounts.critical > 0 || severityCounts.high > 0) {
        summary += `\n**Action Required:** Please address critical and high severity issues before merging.`;
    } else {
        summary += `\n**Good to go!** No critical or high severity issues found.`;
    }

    return summary;
}

// Run the script
main();