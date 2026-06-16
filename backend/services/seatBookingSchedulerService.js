const cron = require("node-cron");
const SeatBooking = require("../models/SeatReserve");

/**
 * Initializes the seat booking scheduler.
 * Call this once from server.js after DB connection is ready.
 */
function initSeatBookingScheduler() {
  // Cron: "30 16 * * *" = every day at 16:30 (4:30 PM)
  // timezone: 'Asia/Colombo' = Sri Lanka Standard Time (UTC+5:30)
  // Expire all active seat bookings for today or past dates
  cron.schedule(
    "30 16 * * *",
    async () => {
      console.log(
        "\n⏰ [Scheduler] 4:30 PM Sri Lanka Time — Expiring today's active seat bookings...",
      );
      try {
        const today = new Date();
        // Use local timezone to determine what "today" means, but for query we can just expire anything
        // where bookingDate <= today's UTC midnight (which means today's bookings, since they are stored as UTC midnight)
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const result = await SeatBooking.updateMany(
          { 
            status: "active",
            bookingDate: { $lt: tomorrow } 
          },
          { $set: { status: "expired" } }
        );
        
        console.log(`✅ [Scheduler] Expired ${result.modifiedCount} seat bookings.`);
      } catch (err) {
        console.error("[Scheduler] Error expiring seat bookings:", err);
      }
    },
    { timezone: "Asia/Colombo" }
  );

  console.log(
    "✅ [Scheduler] Daily 4:30 PM seat booking expiration job registered (Asia/Colombo timezone)",
  );
}

module.exports = { initSeatBookingScheduler };
