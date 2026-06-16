const axios = require('axios');

// Test the new admin sync endpoint
async function testSyncEndpoint() {
    try {
        console.log('Testing SLT API sync endpoint...');
        
        // You would need to replace these with actual admin credentials and server URL
        const adminEmail = 'admin@example.com'; // Replace with actual admin email
        const adminPassword = 'password'; // Replace with actual password
        const serverUrl = 'http://localhost:3000'; // Replace with actual server URL
        
        console.log('Note: This is a dry-run test script.');
        console.log('To actually test, you need to:');
        console.log('1. Start the backend server');
        console.log('2. Login as admin to get a valid JWT token');
        console.log('3. Use the token in the Authorization header');
        console.log('');
        
        // Example of how the request would look:
        const exampleRequest = {
            method: 'POST',
            url: `${serverUrl}/api/admin/sync/slt-api`,
            headers: {
                'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE',
                'Content-Type': 'application/json'
            },
            data: {
                enableCleanup: true // Set to false for sync without cleanup
            }
        };
        
        console.log('Example request configuration:');
        console.log(JSON.stringify(exampleRequest, null, 2));
        
        console.log('');
        console.log('Expected response format:');
        console.log(JSON.stringify({
            success: true,
            message: "SLT API sync completed successfully",
            data: {
                totalProcessed: 100,
                newInterns: 5,
                updatedInterns: 10,
                removedInterns: 2,
                cleanupEnabled: true
            }
        }, null, 2));
        
    } catch (error) {
        console.error('Error in test script:', error.message);
    }
}

testSyncEndpoint();