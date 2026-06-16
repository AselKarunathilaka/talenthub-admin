const cron = require("node-cron");
const SLTApiService = require("./sltApiService");
const InternRepository = require("../repositories/internRepository");

class SLTApiScheduler {
  static init() {
    console.log("🕐 Initializing SLT API synchronization scheduler...");

    // Schedule sync every 4 minutes to catch API changes
    // Cron pattern: '*/4 * * * *' (minute hour day-of-month month day-of-week)
    const syncCronExpression = "*/4 * * * *";

    cron.schedule(
      syncCronExpression,
      async () => {
        console.log("\n⏰ SLT API synchronization triggered by scheduler");
        console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);

        try {
          await SLTApiScheduler.performScheduledSync();
        } catch (error) {
          console.error("❌ Scheduler sync error:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Colombo",
      },
    );

    const updateCronExpression = "0 2 * * *";

    cron.schedule(
      updateCronExpression,
      async () => {
        console.log("\n⏰ SLT API comprehensive update triggered by scheduler");
        console.log(`🗓️  Scheduled time: ${new Date().toLocaleString()}`);

        try {
          await SLTApiScheduler.performComprehensiveUpdate();
        } catch (error) {
          console.error("❌ Scheduler comprehensive update error:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Asia/Colombo",
      },
    );

    console.log("✅ SLT API scheduler initialized successfully!");
    console.log(`📅 Regular sync: Every 4 minutes`);
    console.log(
      `📅 Comprehensive update: Daily at 2:00 AM (Asia/Colombo time)`,
    );
  }

  /**
   *  SAFETY GUARD: Validate the API response looks legitimate before
   * allowing any deletions. If Prohub is down or returns an empty/tiny
   * response we abort the cleanup phase entirely so no data is lost.
   *
   * Rules:
   *  1. Must have received at least MIN_EXPECTED_TRAINEES records.
   *  2. The API result must be no more than MAX_DROP_PERCENT% smaller than
   *     the current DB count (catches partial outage / truncated responses).
   */
  static async isApiResponseSafeForCleanup(apiTrainees) {
    const MIN_EXPECTED_TRAINEES = 5;
    const MAX_DROP_PERCENT = 50;

    if (!apiTrainees || apiTrainees.length < MIN_EXPECTED_TRAINEES) {
      console.warn(
        `🛡️  Safety guard: API returned only ${apiTrainees?.length ?? 0} trainees ` +
          `(minimum expected: ${MIN_EXPECTED_TRAINEES}). Cleanup ABORTED to protect data.`,
      );
      return false;
    }

    const dbInterns = await InternRepository.getAllInterns();

    // Exclude test accounts — they never appear in the API so including them
    // would artificially inflate the DB count and trigger a false-positive abort.
    const realInterns = dbInterns.filter((i) => !i.isTestAccount);

    if (realInterns.length === 0) return true; // empty DB — nothing to protect

    const dropPercent =
      ((realInterns.length - apiTrainees.length) / realInterns.length) * 100;

    if (dropPercent > MAX_DROP_PERCENT) {
      console.warn(
        `🛡️  Safety guard: API returned ${apiTrainees.length} trainees but DB has ` +
          `${realInterns.length} real interns (${dropPercent.toFixed(1)}% drop > ${MAX_DROP_PERCENT}% threshold). ` +
          `Cleanup ABORTED — Prohub may be down or returning partial data.`,
      );
      return false;
    }

    return true;
  }

  /**
   * Perform regular scheduled synchronization
   */
  static async performScheduledSync() {
    console.log("🔄 Starting scheduled SLT API synchronization...");

    try {
      const enableCleanup =
        process.env.AUTO_CLEANUP_INACTIVE_INTERNS === "true";

      console.log(`🧹 Auto cleanup enabled: ${enableCleanup}`);

      // Lazy require breaks the circular dependency
      const InternService = require("./internService");

      const result = await InternService.syncWithSLTAPI({ enableCleanup });

      console.log("✅ Scheduled sync completed:", result.message);

      if (result.success && result.stats) {
        console.log(
          `📊 Sync Stats: Added: ${result.stats.added}, Updated: ${result.stats.updated}, ` +
            `Removed: ${result.stats.removed}, Skipped: ${result.stats.skipped}, Errors: ${result.stats.errors}`,
        );
      }

      return result;
    } catch (error) {
      console.error("❌ Scheduled sync failed:", error.message);
      return {
        success: false,
        message: `Scheduled sync failed: ${error.message}`,
        stats: {
          added: 0,
          updated: 0,
          removed: 0,
          skipped: 0,
          errors: 1,
          totalProcessed: 0,
        },
      };
    }
  }

  /**
   * Perform comprehensive update - specifically for missing data
   */
  static async performComprehensiveUpdate() {
    console.log("🔍 Starting comprehensive SLT API update for missing data...");

    try {
      const activeTrainees = await SLTApiService.fetchActiveTrainees();
      const mappedTrainees = SLTApiService.mapToInternSchema(activeTrainees);

      const dbInterns = await InternRepository.getAllInterns();

      let updatedCount = 0;
      let errorCount = 0;
      let missingDataCount = 0;
      let notFoundInApiCount = 0;

      console.log(
        `📥 Processing ${dbInterns.length} database records against ${mappedTrainees.length} API trainees...`,
      );

      for (const dbIntern of dbInterns) {
        try {
          const apiTrainee = mappedTrainees.find(
            (t) => t.traineeId.toString() === dbIntern.Trainee_ID?.toString(),
          );

          if (!apiTrainee) {
            console.log(
              `⚠️ Trainee ${dbIntern.Trainee_ID} (${dbIntern.Trainee_Name}) not found in current API - might be inactive`,
            );
            notFoundInApiCount++;
            continue;
          }

          const needsUpdate = SLTApiScheduler.checkIfUpdateNeeded(
            dbIntern,
            apiTrainee,
          );

          if (needsUpdate.required) {
            missingDataCount++;
            console.log(
              `🔧 Updating ${dbIntern.Trainee_Name} (${dbIntern.Trainee_ID}): ${needsUpdate.reasons.join(", ")}`,
            );

            const updateData = SLTApiScheduler.prepareUpdateData(
              dbIntern,
              apiTrainee,
            );

            if (Object.keys(updateData).length > 0) {
              await InternRepository.updateIntern(dbIntern._id, updateData);
              updatedCount++;
              console.log(
                `✅ Updated: ${dbIntern.Trainee_Name} - ${Object.keys(updateData).join(", ")}`,
              );
            }
          }
        } catch (error) {
          console.error(
            `❌ Error processing ${dbIntern.Trainee_ID}:`,
            error.message,
          );
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
          totalProcessed: dbInterns.length,
        },
      };

      console.log("✅ Comprehensive update completed:", result.message);
      return result;
    } catch (error) {
      console.error("❌ Comprehensive update failed:", error.message);
      return {
        success: false,
        message: `Comprehensive update failed: ${error.message}`,
        stats: {
          updated: 0,
          missingData: 0,
          notFoundInApi: 0,
          errors: 1,
          totalProcessed: 0,
        },
      };
    }
  }

  /**
   * Check if a database intern record needs updating compared to API data
   */
  static checkIfUpdateNeeded(dbIntern, apiTrainee) {
    const reasons = [];

    const dbEmail = dbIntern.Trainee_Email || "";
    if (!dbEmail || dbEmail.trim() === "") {
      if (apiTrainee.email && apiTrainee.email.trim() !== "")
        reasons.push("missing email");
    } else if (apiTrainee.email && dbEmail !== apiTrainee.email) {
      reasons.push("email updated");
    }

    if (!dbIntern.Training_StartDate) {
      if (apiTrainee.trainingStartDate) reasons.push("missing start date");
    } else if (apiTrainee.trainingStartDate) {
      if (
        new Date(dbIntern.Training_StartDate).getTime() !==
        new Date(apiTrainee.trainingStartDate).getTime()
      )
        reasons.push("start date updated");
    }

    if (!dbIntern.Training_EndDate) {
      if (apiTrainee.trainingEndDate) reasons.push("missing end date");
    } else if (apiTrainee.trainingEndDate) {
      if (
        new Date(dbIntern.Training_EndDate).getTime() !==
        new Date(apiTrainee.trainingEndDate).getTime()
      )
        reasons.push("end date updated");
    }

    if (dbIntern.Trainee_Name !== apiTrainee.traineeName)
      reasons.push("name updated");

    const dbInstitute = dbIntern.Institute || "";
    if (!dbInstitute || dbInstitute.trim() === "") {
      if (apiTrainee.institute && apiTrainee.institute.trim() !== "")
        reasons.push("missing institute");
    } else if (apiTrainee.institute && dbInstitute !== apiTrainee.institute) {
      reasons.push("institute updated");
    }

    const dbField = dbIntern.field_of_spec_name || "";
    if (!dbField || dbField.trim() === "") {
      if (
        apiTrainee.fieldOfSpecialization &&
        apiTrainee.fieldOfSpecialization.trim() !== ""
      )
        reasons.push("missing field of specialization");
    } else if (
      apiTrainee.fieldOfSpecialization &&
      dbField !== apiTrainee.fieldOfSpecialization
    ) {
      reasons.push("field of specialization updated");
    }

    return { required: reasons.length > 0, reasons };
  }

  /**
   * Prepare update data object with only changed/missing fields
   */
  static prepareUpdateData(dbIntern, apiTrainee) {
    const updateData = {};

    // Update email if missing or different
    const dbEmail = dbIntern.Trainee_Email || "";
    if ((!dbEmail || dbEmail.trim() === "") && apiTrainee.email?.trim()) {
      updateData.email = apiTrainee.email;
    } else if (apiTrainee.email && dbEmail !== apiTrainee.email) {
      updateData.email = apiTrainee.email;
    }

    // Update training start date if missing or different
    if (!dbIntern.Training_StartDate && apiTrainee.trainingStartDate) {
      updateData.trainingStartDate = apiTrainee.trainingStartDate;
    } else if (apiTrainee.trainingStartDate) {
      if (
        new Date(dbIntern.Training_StartDate).getTime() !==
        new Date(apiTrainee.trainingStartDate).getTime()
      )
        updateData.trainingStartDate = apiTrainee.trainingStartDate;
    }

    // Update training end date if missing or different
    if (!dbIntern.Training_EndDate && apiTrainee.trainingEndDate) {
      updateData.trainingEndDate = apiTrainee.trainingEndDate;
    } else if (apiTrainee.trainingEndDate) {
      if (
        new Date(dbIntern.Training_EndDate).getTime() !==
        new Date(apiTrainee.trainingEndDate).getTime()
      )
        updateData.trainingEndDate = apiTrainee.trainingEndDate;
    }

    // Update name if different
    if (dbIntern.Trainee_Name !== apiTrainee.traineeName)
      updateData.traineeName = apiTrainee.traineeName;

    const dbInstitute = dbIntern.Institute || "";
    if (
      (!dbInstitute || dbInstitute.trim() === "") &&
      apiTrainee.institute?.trim()
    ) {
      updateData.institute = apiTrainee.institute;
    } else if (apiTrainee.institute && dbInstitute !== apiTrainee.institute) {
      updateData.institute = apiTrainee.institute;
    }

    // Update field of specialization if missing or different
    const dbField = dbIntern.field_of_spec_name || "";
    if (
      (!dbField || dbField.trim() === "") &&
      apiTrainee.fieldOfSpecialization?.trim()
    ) {
      updateData.fieldOfSpecialization = apiTrainee.fieldOfSpecialization;
    } else if (
      apiTrainee.fieldOfSpecialization &&
      dbField !== apiTrainee.fieldOfSpecialization
    ) {
      updateData.fieldOfSpecialization = apiTrainee.fieldOfSpecialization;
    }

    return updateData;
  }

  /**
   * Manual trigger for comprehensive update
   */
  static async triggerManualUpdate() {
    console.log("\n🔧 Manual comprehensive update triggered");
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    try {
      const result = await SLTApiScheduler.performComprehensiveUpdate();
      return {
        success: true,
        timestamp: new Date(),
        type: "comprehensive_update",
        results: result,
      };
    } catch (error) {
      console.error("❌ Manual comprehensive update error:", error);
      return {
        success: false,
        timestamp: new Date(),
        type: "comprehensive_update",
        error: error.message,
      };
    }
  }

  /**
   * Manual trigger for regular sync
   */
  static async triggerManualSync() {
    console.log("\n🔧 Manual sync triggered");
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    try {
      const result = await SLTApiScheduler.performScheduledSync();
      return {
        success: true,
        timestamp: new Date(),
        type: "regular_sync",
        results: result,
      };
    } catch (error) {
      console.error("❌ Manual sync error:", error);
      return {
        success: false,
        timestamp: new Date(),
        type: "regular_sync",
        error: error.message,
      };
    }
  }

  /**
   * Remove interns from MongoDB that are no longer present in the SLT API.
   *
   * LOGIC:
   * - All interns not found in API are moved to InactiveInterns collection
   *
   * Safety guard prevents deletion when API response looks abnormally small.
   */
  static async performDataCleanup() {
    console.log(
      "🧹 Starting data cleanup - processing interns no longer in SLT API...",
    );

    try {
      const activeTrainees = await SLTApiService.fetchActiveTrainees();
      const mappedTrainees = SLTApiService.mapToInternSchema(activeTrainees);

      // SAFETY CHECK: abort if API response looks like an outage
      const isSafe =
        await SLTApiScheduler.isApiResponseSafeForCleanup(activeTrainees);
      if (!isSafe) {
        return {
          success: false,
          message:
            "Cleanup aborted: API response failed safety validation (possible outage or empty response)",
          stats: {
            totalInDb: 0,
            activeInApi: activeTrainees?.length ?? 0,
            inactivated: 0,
            terminated: 0,
            errors: 0,
          },
        };
      }

      const dbInterns = await InternRepository.getAllInterns();

      // Create a set of active trainee IDs from API
      const activeTraineeIds = new Set(
        mappedTrainees
          .map((t) => t.traineeId?.toString())
          .filter((id) => id && id.trim() !== ""),
      );

      const internsToProcess = dbInterns.filter((intern) => {
        if (intern.isTestAccount) return false;
        const traineeId = intern.Trainee_ID?.toString();
        return traineeId && !activeTraineeIds.has(traineeId);
      });

      console.log(
        `📊 Analysis: ${dbInterns.length} total in DB, ${activeTrainees.length} active in API, ${internsToProcess.length} to process`,
      );

      if (internsToProcess.length === 0) {
        console.log("✅ No inactive interns found - database is clean");
        return {
          success: true,
          message: "No inactive interns found to process",
          stats: {
            totalInDb: dbInterns.length,
            activeInApi: activeTrainees.length,
            inactivated: 0,
            terminated: 0,
            errors: 0,
          },
        };
      }

      console.log("🔄 Interns to be processed (not found in API):");
      internsToProcess.forEach((intern) => {
        const endDate = intern.Training_EndDate
          ? new Date(intern.Training_EndDate).toLocaleDateString()
          : "No date";
        console.log(
          `   - ${intern.Trainee_ID}: ${intern.Trainee_Name} (End: ${endDate})`,
        );
      });

      let inactivatedCount = 0;
      let errorCount = 0;

      // Move all interns not in API to InactiveInterns collection
      console.log(
        `📦 Processing ${internsToProcess.length} interns no longer in API...`,
      );

      try {
        const idsToInactivate = internsToProcess.map((intern) => intern._id);
        const result = await InternRepository.removeMultipleInterns(
          idsToInactivate,
          "not_in_api",
        );

        inactivatedCount = result.deletedCount;
        console.log(
          `✅ Moved ${inactivatedCount} interns to InactiveInterns collection`,
        );

        internsToProcess.forEach((intern) => {
          const endDate = intern.Training_EndDate
            ? new Date(intern.Training_EndDate).toLocaleDateString()
            : "No date";
          console.log(
            `   ✓ Inactivated: ${intern.Trainee_Name} (${intern.Trainee_ID}) - End: ${endDate}`,
          );
        });
      } catch (batchError) {
        console.error(
          "❌ Batch inactivation failed, trying individual inactivations:",
          batchError.message,
        );

        for (const intern of internsToProcess) {
          try {
            await InternRepository.removeIntern(intern._id, "not_in_api");
            inactivatedCount++;
            console.log(
              `✅ Inactivated: ${intern.Trainee_Name} (${intern.Trainee_ID})`,
            );
          } catch (error) {
            console.error(
              `❌ Failed to inactivate ${intern.Trainee_Name} (${intern.Trainee_ID}):`,
              error.message,
            );
            errorCount++;
          }
        }
      }

      const result = {
        success: true,
        message: `Data cleanup completed: ${inactivatedCount} moved to InactiveInterns, ${errorCount} errors`,
        stats: {
          totalInDb: dbInterns.length,
          activeInApi: activeTrainees.length,
          inactivated: inactivatedCount,
          errors: errorCount,
        },
      };

      console.log("✅ Data cleanup completed:", result.message);
      return result;
    } catch (error) {
      console.error("❌ Data cleanup failed:", error.message);
      return {
        success: false,
        message: `Data cleanup failed: ${error.message}`,
        stats: {
          totalInDb: 0,
          activeInApi: 0,
          inactivated: 0,
          terminated: 0,
          errors: 1,
        },
      };
    }
  }

  /**
   * Manual trigger for data cleanup
   */
  static async triggerManualCleanup() {
    console.log("\n🧹 Manual data cleanup triggered");
    console.log(`⏰ Triggered at: ${new Date().toLocaleString()}`);
    try {
      const result = await SLTApiScheduler.performDataCleanup();
      return {
        success: result.success,
        timestamp: new Date(),
        type: "data_cleanup",
        results: result,
      };
    } catch (error) {
      console.error("❌ Manual cleanup error:", error);
      return {
        success: false,
        timestamp: new Date(),
        type: "data_cleanup",
        error: error.message,
      };
    }
  }

  static async checkForNewInterns() {
    try {
      const activeTrainees = await SLTApiService.fetchActiveTrainees();
      const mappedTrainees = SLTApiService.mapToInternSchema(activeTrainees);

      let addedCount = 0;

      for (const trainee of mappedTrainees) {
        if (!trainee.traineeId) continue;
        const existing = await InternRepository.findByTraineeId(
          trainee.traineeId,
        );
        if (!existing) {
          await InternRepository.addIntern(trainee);
          addedCount++;
          console.log(
            `➕ New intern detected & added: ${trainee.traineeName} (${trainee.traineeId})`,
          );
        }
      }

      if (addedCount > 0) {
        console.log(`✅ New intern check: ${addedCount} intern(s) added`);
      }

      return { success: true, added: addedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = SLTApiScheduler;
