// Script to perform actual cleanup of inactive interns
// This script will remove interns from MongoDB that are not present in SLT API

require('dotenv').config();
const connectDB = require('../config/database');
const InternService = require('../services/internService');

const performCleanup = async () => {
  console.log('🧹 Starting Inactive Intern Cleanup');
  console.log('=' .repeat(50));

  try {
    // Connect to database
    await connectDB();
    console.log('✅ Connected to database');

    // Perform the cleanup
    console.log('\n🔄 Starting cleanup process...');
    const result = await InternService.cleanupInactiveInterns();

    if (result.success) {
      console.log('\n✅ Cleanup completed successfully!');
      console.log(`📊 Results: ${result.message}`);
      console.log('\n📈 Statistics:');
      console.log(`   - Total interns in DB before: ${result.stats.totalInDb}`);
      console.log(`   - Active interns in API: ${result.stats.activeInApi}`);
      console.log(`   - Interns removed: ${result.stats.removed}`);
      console.log(`   - Errors: ${result.stats.errors}`);
      
      const remainingInDb = result.stats.totalInDb - result.stats.removed;
      console.log(`   - Remaining in DB: ${remainingInDb}`);
    } else {
      console.log('\n❌ Cleanup failed!');
      console.log(`Error: ${result.message}`);
      console.log('Statistics:', result.stats);
    }

    console.log('\n' + '=' .repeat(50));
    return result;

  } catch (error) {
    console.error('❌ Unexpected error during cleanup:', error.message);
    return {
      success: false,
      message: `Unexpected error: ${error.message}`,
      stats: { totalInDb: 0, activeInApi: 0, removed: 0, errors: 1 }
    };
  }
};

// Run the cleanup if this script is executed directly
if (require.main === module) {
  performCleanup()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Cleanup operation completed successfully!');
      } else {
        console.log('\n💥 Cleanup operation failed!');
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Script execution error:', error);
      process.exit(1);
    });
}

module.exports = { performCleanup };