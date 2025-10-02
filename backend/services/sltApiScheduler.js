const cron = require('node-cron');
const InternService = require('./internService');
const SLTApiService = require('./sltApiService');
const InternRepository = require('../repositories/internRepository');

class SLTApiScheduler {
  static init() {
    console.log('🕐 Initializing SLT API synchronization scheduler...');
    
    // Schedule sync every 6 hours to catch API changes
    // Cron pattern: '0 */6 * * *' (minute hour day-of-month month day-of-week)
    // This will run at 00:00, 06:00, 12:00, 18:00 daily
    const syncCronExpression = '0 */6 * * *';
    
    cron.schedule(syncCronExpression, async () => {
      console.log('\n⏰ SLT API synchronization triggered by scheduler');
      console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
      
      try {
        await this.performScheduledSync();
      } catch (error) {
        console.error('❌ Scheduler sync error:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Colombo" // Sri Lanka timezone
    });
    
    // Schedule a daily comprehensive update check at 2 AM
    // This will specifically look for missing data and update existing records
    const updateCronExpression = '0 2 * * *';
    
    cron.schedule(updateCronExpression, async () => {
      console.log('\n⏰ SLT API comprehensive update triggered by scheduler');
      console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);
      
      try {
        await this.performComprehensiveUpdate();
      } catch (error) {
        console.error('❌ Scheduler comprehensive update error:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Colombo"
    });
    
    console.log('✅ SLT API scheduler initialized successfully!');
    console.log(`📅 Regular sync: Every 6 hours`);
    console.log(`📅 Comprehensive update: Daily at 2:00 AM (Asia/Colombo time)`);
  }
  
  /**
   * Perform regular scheduled synchronization
   */
  static async performScheduledSync() {
    console.log('🔄 Starting scheduled SLT API synchronization...');
    
    try {
      const result = await InternService.syncWithSLTAPI();
      
      console.log('✅ Scheduled sync completed:', result.message);
      
      // Log sync statistics
      if (result.success && result.stats) {
        console.log(`📊 Sync Stats: Added: ${result.stats.added}, Updated: ${result.stats.updated}, Skipped: ${result.stats.skipped}, Errors: ${result.stats.errors}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Scheduled sync failed:', error.message);
      return {
        success: false,
        message: `Scheduled sync failed: ${error.message}`,
        stats: { added: 0, updated: 0, skipped: 0, errors: 1, totalProcessed: 0 }
      };
    }
  }
  
  /**
   * Perform comprehensive update - specifically for missing data
   */
  static async performComprehensiveUpdate() {
    console.log('🔍 Starting comprehensive SLT API update for missing data...');
    
    try {
      // First get all current API data
      const activeTrainees = await SLTApiService.fetchActiveTrainees();
      const mappedTrainees = SLTApiService.mapToInternSchema(activeTrainees);
      
      // Get all interns from database
      const dbInterns = await InternRepository.getAllInterns();
      
      let updatedCount = 0;
      let errorCount = 0;
      let missingDataCount = 0;
      let notFoundInApiCount = 0;
      
      console.log(`📥 Processing ${dbInterns.length} database records against ${mappedTrainees.length} API trainees...`);
      
      for (const dbIntern of dbInterns) {
        try {
          // Find corresponding API data
          const apiTrainee = mappedTrainees.find(t => t.traineeId.toString() === dbIntern.traineeId.toString());
          
          if (!apiTrainee) {
            // Trainee not found in current API - they might be inactive now
            console.log(`⚠️ Trainee ${dbIntern.traineeId} (${dbIntern.traineeName}) not found in current API - might be inactive`);
            notFoundInApiCount++;
            continue;
          }
          
          // Check for missing or outdated data
          const needsUpdate = this.checkIfUpdateNeeded(dbIntern, apiTrainee);
          
          if (needsUpdate.required) {
            missingDataCount++;
            console.log(`🔧 Updating ${dbIntern.traineeName} (${dbIntern.traineeId}): ${needsUpdate.reasons.join(', ')}`);
            
            // Prepare update data - only update fields that are missing or different
            const updateData = this.prepareUpdateData(dbIntern, apiTrainee);
            
            if (Object.keys(updateData).length > 0) {
              await InternRepository.updateIntern(dbIntern._id, updateData);
              updatedCount++;
              console.log(`✅ Updated: ${dbIntern.traineeName} - ${Object.keys(updateData).join(', ')}`);
            }
          }
          
        } catch (error) {
          console.error(`❌ Error processing ${dbIntern.traineeId}:`, error.message);
          errorCount++;
        }
      }
      
      const result = {
        success: true,
        message: `Comprehensive update completed: ${updatedCount} updated, ${missingDataCount} had missing data, ${notFoundInApiCount} not in API, ${errorCount} errors`,
        stats: {
          updated: updatedCount,
          missingData: missingDataCount,
          notFoundInApi: notFoundInApiCount,
          errors: errorCount,
          totalProcessed: dbInterns.length
        }
      };
      
      console.log('✅ Comprehensive update completed:', result.message);
      return result;
      
    } catch (error) {
      console.error('❌ Comprehensive update failed:', error.message);
      return {
        success: false,
        message: `Comprehensive update failed: ${error.message}`,
        stats: { updated: 0, missingData: 0, notFoundInApi: 0, errors: 1, totalProcessed: 0 }
      };
    }
  }
  
  /**
   * Check if a database intern record needs updating compared to API data
   */
  static checkIfUpdateNeeded(dbIntern, apiTrainee) {
    const reasons = [];
    
    // Check email
    if (!dbIntern.email || dbIntern.email.trim() === '') {
      if (apiTrainee.email && apiTrainee.email.trim() !== '') {
        reasons.push('missing email');
      }
    } else if (apiTrainee.email && dbIntern.email !== apiTrainee.email) {
      reasons.push('email updated');
    }
    
    // Check training start date
    if (!dbIntern.trainingStartDate) {
      if (apiTrainee.trainingStartDate) {
        reasons.push('missing start date');
      }
    } else if (apiTrainee.trainingStartDate) {
      const dbDate = new Date(dbIntern.trainingStartDate).getTime();
      const apiDate = new Date(apiTrainee.trainingStartDate).getTime();
      if (dbDate !== apiDate) {
        reasons.push('start date updated');
      }
    }
    
    // Check training end date
    if (!dbIntern.trainingEndDate) {
      if (apiTrainee.trainingEndDate) {
        reasons.push('missing end date');
      }
    } else if (apiTrainee.trainingEndDate) {
      const dbDate = new Date(dbIntern.trainingEndDate).getTime();
      const apiDate = new Date(apiTrainee.trainingEndDate).getTime();
      if (dbDate !== apiDate) {
        reasons.push('end date updated');
      }
    }
    
    // Check name updates
    if (dbIntern.traineeName !== apiTrainee.traineeName) {
      reasons.push('name updated');
    }
    
    // Check institute
    if (!dbIntern.institute || dbIntern.institute.trim() === '') {
      if (apiTrainee.institute && apiTrainee.institute.trim() !== '') {
        reasons.push('missing institute');
      }
    } else if (apiTrainee.institute && dbIntern.institute !== apiTrainee.institute) {
      reasons.push('institute updated');
    }
    
    // Check field of specialization
    if (!dbIntern.fieldOfSpecialization || dbIntern.fieldOfSpecialization.trim() === '') {
      if (apiTrainee.fieldOfSpecialization && apiTrainee.fieldOfSpecialization.trim() !== '') {
        reasons.push('missing field of specialization');
      }
    } else if (apiTrainee.fieldOfSpecialization && dbIntern.fieldOfSpecialization !== apiTrainee.fieldOfSpecialization) {
      reasons.push('field of specialization updated');
    }
    
    return {
      required: reasons.length > 0,
      reasons: reasons
    };
  }
  
  /**
   * Prepare update data object with only changed/missing fields
   */
  static prepareUpdateData(dbIntern, apiTrainee) {
    const updateData = {};
    
    // Update email if missing or different
    if ((!dbIntern.email || dbIntern.email.trim() === '') && apiTrainee.email && apiTrainee.email.trim() !== '') {
      updateData.email = apiTrainee.email;
    } else if (apiTrainee.email && dbIntern.email !== apiTrainee.email) {
      updateData.email = apiTrainee.email;
    }
    
    // Update training start date if missing or different
    if (!dbIntern.trainingStartDate && apiTrainee.trainingStartDate) {
      updateData.trainingStartDate = apiTrainee.trainingStartDate;
    } else if (apiTrainee.trainingStartDate) {
      const dbDate = new Date(dbIntern.trainingStartDate).getTime();
      const apiDate = new Date(apiTrainee.trainingStartDate).getTime();
      if (dbDate !== apiDate) {
        updateData.trainingStartDate = apiTrainee.trainingStartDate;
      }
    }
    
    // Update training end date if missing or different
    if (!dbIntern.trainingEndDate && apiTrainee.trainingEndDate) {
      updateData.trainingEndDate = apiTrainee.trainingEndDate;
    } else if (apiTrainee.trainingEndDate) {
      const dbDate = new Date(dbIntern.trainingEndDate).getTime();
      const apiDate = new Date(apiTrainee.trainingEndDate).getTime();
      if (dbDate !== apiDate) {
        updateData.trainingEndDate = apiTrainee.trainingEndDate;
      }
    }
    
    // Update name if different
    if (dbIntern.traineeName !== apiTrainee.traineeName) {
      updateData.traineeName = apiTrainee.traineeName;
    }
    
    // Update institute if missing or different
    if ((!dbIntern.institute || dbIntern.institute.trim() === '') && apiTrainee.institute && apiTrainee.institute.trim() !== '') {
      updateData.institute = apiTrainee.institute;
    } else if (apiTrainee.institute && dbIntern.institute !== apiTrainee.institute) {
      updateData.institute = apiTrainee.institute;
    }
    
    // Update field of specialization if missing or different
    if ((!dbIntern.fieldOfSpecialization || dbIntern.fieldOfSpecialization.trim() === '') && apiTrainee.fieldOfSpecialization && apiTrainee.fieldOfSpecialization.trim() !== '') {
      updateData.fieldOfSpecialization = apiTrainee.fieldOfSpecialization;
    } else if (apiTrainee.fieldOfSpecialization && dbIntern.fieldOfSpecialization !== apiTrainee.fieldOfSpecialization) {
      updateData.fieldOfSpecialization = apiTrainee.fieldOfSpecialization;
    }
    
    return updateData;
  }
  
  /**
   * Manual trigger for comprehensive update
   */
  static async triggerManualUpdate() {
    console.log('\n🔧 Manual comprehensive update triggered');
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    
    try {
      const result = await this.performComprehensiveUpdate();
      return {
        success: true,
        timestamp: new Date(),
        type: 'comprehensive_update',
        results: result
      };
    } catch (error) {
      console.error('❌ Manual comprehensive update error:', error);
      return {
        success: false,
        timestamp: new Date(),
        type: 'comprehensive_update',
        error: error.message
      };
    }
  }
  
  /**
   * Manual trigger for regular sync
   */
  static async triggerManualSync() {
    console.log('\n🔧 Manual sync triggered');
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    
    try {
      const result = await this.performScheduledSync();
      return {
        success: true,
        timestamp: new Date(),
        type: 'regular_sync',
        results: result
      };
    } catch (error) {
      console.error('❌ Manual sync error:', error);
      return {
        success: false,
        timestamp: new Date(),
        type: 'regular_sync',
        error: error.message
      };
    }
  }
}

module.exports = SLTApiScheduler;