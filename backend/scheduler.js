// backend/scheduler.js
// Runs location-fix scripts every Saturday at 11:00 PM

const cron = require("node-cron");
const { exec } = require("child_process");
const path = require("path");

const SCRIPTS_DIR = path.join(__dirname, "scripts");

const scripts = [
  "fixAllInternLocations.js",
  "syncPastInternLocations.js",
  "verifyAndFixInternLocations.js",
  "verifyAndFixPastInternLocations.js",
];

// Runs a single script and returns a Promise
const runScript = (scriptName) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    console.log(`[Scheduler] Starting: ${scriptName}`);

    exec(`node ${scriptPath}`, { env: process.env }, (error, stdout, stderr) => {
      if (stdout) console.log(`[${scriptName}] stdout:\n${stdout}`);
      if (stderr) console.error(`[${scriptName}] stderr:\n${stderr}`);

      if (error) {
        console.error(`[Scheduler] ERROR in ${scriptName}: ${error.message}`);
        reject(error);
      } else {
        console.log(`[Scheduler] Finished: ${scriptName}`);
        resolve();
      }
    });
  });
};

// Runs all 4 scripts one after another (not in parallel — avoids DB conflicts)
const runAllScripts = async () => {
  console.log("[Scheduler] Saturday night job started at", new Date().toISOString());

  for (const script of scripts) {
    try {
      await runScript(script);
    } catch (err) {
      // Log the error but continue to the next script
      console.error(`[Scheduler] Skipping remaining scripts due to error in ${script}`);
      break;
    }
  }

  console.log("[Scheduler] Saturday night job completed at", new Date().toISOString());
};

// Cron schedule: every Saturday at 11:00 PM
// Format: second(optional) minute hour day-of-month month day-of-week
// '0 23 * * 6' = at 23:00 on Saturday (6 = Saturday)
cron.schedule("0 23 * * 6", () => {
  runAllScripts();
}, {
  timezone: "Asia/Colombo", // Sri Lanka timezone — change if needed
});

console.log("[Scheduler] Registered: location scripts will run every Saturday at 11:00 PM (Asia/Colombo)");

module.exports = { runAllScripts }; // exported so you can trigger manually if needed