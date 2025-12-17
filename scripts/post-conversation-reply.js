const { Octokit } = require('@octokit/rest');
const fs = require('fs');

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

async function postReply() {
    console.log('Posting conversation reply...');

    // Read the response
    const response = JSON.parse(fs.readFileSync('conversation-response.json', 'utf8'));

    try {
        // Post reply to the comment thread
        const { data } = await octokit.pulls.createReplyForReviewComment({
            owner,
            repo,
            pull_number: response.prNumber,
            comment_id: response.commentId,
            body: response.answer
        });

        console.log('Reply posted successfully');
        console.log(`   Comment ID: ${data.id}`);
        console.log(`   URL: ${data.html_url}`);

    } catch (error) {
        console.error('Failed to post reply:', error.message);
        throw error;
    }
}

postReply().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});