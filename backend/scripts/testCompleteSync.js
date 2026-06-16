const Intern = require('../models/Intern');
const internService = require('../services/internService');
require('dotenv').config();

/**
 * Test the complete sync implementation including the cleanup functionality
 * This script tests the internService.syncWithSLTAPI method directly
 */
async function testSyncImplementation() {
    try {
        console.log('🧪 Testing SLT API Sync Implementation...\n');

        // First, get current database state
        console.log('📊 Current Database State:');
        const currentInterns = await Intern.find({});
        console.log(`Total interns in database: ${currentInterns.length}`);
        
        // Show a few sample intern IDs
        const sampleIds = currentInterns.slice(0, 5).map(intern => intern.Trainee_ID || intern.traineeId);
        console.log(`Sample intern IDs: ${sampleIds.join(', ')}`);
        console.log('');

        // Test sync without cleanup first
        console.log('🔄 Testing sync WITHOUT cleanup...');
        const syncResultNoCleanup = await internService.syncWithSLTAPI(false);
        
        console.log('Sync Result (No Cleanup):');
        console.log(`Success: ${syncResultNoCleanup.success}`);
        console.log(`Message: ${syncResultNoCleanup.message}`);
        console.log('Stats:', JSON.stringify(syncResultNoCleanup.stats, null, 2));
        console.log('');

        // Get updated database state
        const internsAfterSync = await Intern.find({});
        console.log(`Interns after sync (no cleanup): ${internsAfterSync.length}`);
        console.log('');

        // Test sync WITH cleanup
        console.log('🧹 Testing sync WITH cleanup...');
        const syncResultWithCleanup = await internService.syncWithSLTAPI(true);
        
        console.log('Sync Result (With Cleanup):');
        console.log(`Success: ${syncResultWithCleanup.success}`);
        console.log(`Message: ${syncResultWithCleanup.message}`);
        console.log('Stats:', JSON.stringify(syncResultWithCleanup.stats, null, 2));
        console.log('');

        // Get final database state
        const internsAfterCleanup = await Intern.find({});
        console.log(`Interns after sync with cleanup: ${internsAfterCleanup.length}`);
        
        // Show the difference
        const removedCount = internsAfterSync.length - internsAfterCleanup.length;
        console.log(`Interns removed during cleanup: ${removedCount}`);
        
        console.log('\n✅ Sync implementation test completed!');
        console.log('The admin endpoint should now work with these results.');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Only run if called directly
if (require.main === module) {
    testSyncImplementation()
        .then(() => {
            console.log('\n🎯 Test completed. You can now test the admin endpoint:');
            console.log('POST /api/admin/sync/slt-api');
            console.log('Body: { "enableCleanup": true }');
            console.log('Headers: { "Authorization": "Bearer YOUR_JWT_TOKEN" }');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { testSyncImplementation };