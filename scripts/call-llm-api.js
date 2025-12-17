const fs = require('fs');
// const core = require('@actions/core');
const axios = require('axios');
const getGitHubOIDCToken = require('./github-oidc-config.js');

const API_BASE_URL = process.env.API_BASE_URL || "https://ai-code-reviewer-restless-violet-7974.fly.dev";

/**
 * Get GitHub OIDC token for authentication
 */
// async function getGitHubOIDCToken() {
//     const originalLog = console.log;
//     const originalError = console.error;

//     try {
//         console.log = () => { };
//         console.error = () => { };

//         const token = await core.getIDToken(API_BASE_URL);

//         console.log = originalLog;
//         console.error = originalError;

//         if (!token) {
//             throw new Error("GitHub Actions did not return a token");
//         }

//         return token;

//     } catch (error) {
//         console.log = originalLog;
//         console.error = originalError;
//         throw error;
//     }
// }

/**
 * Call the conversation API with full context
 */
async function callConversationAPI() {
    console.log('🚀 Calling Conversation API...');

    // Read the enriched context from previous step
    const context = JSON.parse(fs.readFileSync('llm-context.json', 'utf8'));

    try {
        // Get OIDC token
        console.log('🔐 Getting GitHub OIDC token...');
        const oidcToken = await getGitHubOIDCToken();

        // Call your backend API
        console.log('Sending request...');
        const response = await axios.post(
            `${API_BASE_URL}/review/thread`,
            context,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${oidcToken}`
                }
            }
        );

        console.log('✅ Response received');

        // Save the response
        const result = {
            answer: response.data.answer,
            commentId: context.conversationContext.commentId,
            prNumber: context.conversationContext.prNumber,
            filePath: context.codeContext?.filePath,
            line: context.codeContext?.targetLine,
            timestamp: response.data.timestamp
        };

        fs.writeFileSync('conversation-response.json', JSON.stringify(result, null, 2));

        console.log('✅ Response saved to conversation-response.json');
        console.log(`\n📝 Answer preview:\n${response.data.answer.substring(0, 200)}...`);

    } catch (error) {
        console.error('❌ API call failed:', error.message);

        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${error.response.data?.error || 'Unknown error'}`);
            console.error(`   Code: ${error.response.data?.code || 'N/A'}`);
        }

        throw error;
    }
}

callConversationAPI().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});