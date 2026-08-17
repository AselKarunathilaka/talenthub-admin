const os = require("os");
const moment = require("moment-timezone");
const ScheduledEmailLog = require("../models/ScheduledEmailLog");

const TZ = "Asia/Colombo";

// A claim left "in_progress" for longer than this is assumed to belong to a
// process that crashed mid-send, and may be taken over by another run.
const STALE_CLAIM_MS = 30 * 60 * 1000;

/**
 * Cross-process, once-per-period guard for scheduled outbound emails.
 *
 * Every scheduled job that emails people should wrap its send in
 * `claim()` / `markSent()` / `release()`. The claim is a uniquely indexed
 * document, so if two backend instances (e.g. production and a developer's
 * machine running against the same MongoDB) fire the same cron at the same
 * time, only one of them actually sends.
 */
class ScheduledEmailGuard {
  /** Colombo-local date of "now", used as the default period key. */
  static todayKey() {
    return moment().tz(TZ).format("YYYY-MM-DD");
  }

  static owner() {
    return `${os.hostname()}#${process.pid}`;
  }

  /**
   * Try to become the sender for (jobKey, periodKey).
   *
   * @returns {Promise<{claimed: boolean, reason?: string, existing?: object}>}
   *          claimed=true  → this process owns the send, go ahead.
   *          claimed=false → somebody already sent (or is sending) this period.
   */
  static async claim(jobKey, periodKey, meta = {}) {
    const claimedBy = this.owner();

    try {
      await ScheduledEmailLog.create({
        jobKey,
        periodKey,
        status: "in_progress",
        meta,
        claimedBy,
        startedAt: new Date(),
      });
      return { claimed: true };
    } catch (error) {
      // 11000 = duplicate key → another process got here first.
      if (error?.code !== 11000) throw error;

      const existing = await ScheduledEmailLog.findOne({ jobKey, periodKey });

      if (existing?.status === "sent") {
        return { claimed: false, reason: "already-sent", existing };
      }

      // Another run is mid-flight. Only take over if it looks abandoned.
      const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
      const takenOver = await ScheduledEmailLog.findOneAndUpdate(
        {
          jobKey,
          periodKey,
          status: "in_progress",
          startedAt: { $lt: staleBefore },
        },
        { $set: { claimedBy, startedAt: new Date(), meta } },
        { new: true },
      );

      if (takenOver) {
        console.warn(
          `⚠️  [${jobKey}] Taking over a stale claim for ${periodKey} (previous owner: ${existing?.claimedBy || "unknown"})`,
        );
        return { claimed: true };
      }

      return { claimed: false, reason: "in-progress-elsewhere", existing };
    }
  }

  /** Mark the period as successfully dispatched. */
  static async markSent(jobKey, periodKey, meta = {}) {
    await ScheduledEmailLog.updateOne(
      { jobKey, periodKey },
      {
        $set: {
          status: "sent",
          completedAt: new Date(),
          ...Object.fromEntries(
            Object.entries(meta).map(([k, v]) => [`meta.${k}`, v]),
          ),
        },
      },
    );
  }

  /**
   * Give up the claim (send failed / was skipped) so a retry or the next run
   * is allowed to send.
   */
  static async release(jobKey, periodKey) {
    await ScheduledEmailLog.deleteOne({
      jobKey,
      periodKey,
      status: "in_progress",
    });
  }

  /**
   * Run `task` at most once per (jobKey, periodKey) across all processes.
   *
   * `task` must resolve to `{ sent: boolean, meta?: object }`. When it resolves
   * with sent=false (or throws) the claim is released so the period can be
   * retried.
   */
  static async runOnce(jobKey, periodKey, task, meta = {}) {
    const claim = await this.claim(jobKey, periodKey, meta);

    if (!claim.claimed) {
      console.log(
        `⏭️  [${jobKey}] Skipping ${periodKey} — ${claim.reason} (owner: ${claim.existing?.claimedBy || "unknown"}). No duplicate email sent.`,
      );
      return { skipped: true, reason: claim.reason };
    }

    try {
      const outcome = await task();

      if (outcome && outcome.sent) {
        await this.markSent(jobKey, periodKey, outcome.meta || {});
      } else {
        await this.release(jobKey, periodKey);
      }

      return { skipped: false, ...outcome };
    } catch (error) {
      await this.release(jobKey, periodKey);
      throw error;
    }
  }
}

module.exports = ScheduledEmailGuard;
