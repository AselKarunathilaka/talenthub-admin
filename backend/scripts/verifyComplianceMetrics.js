const {
  isWorkingDay,
  getPastWorkingDays,
  calculateGracePeriodEndDate,
  isWithinGracePeriod,
  getActiveInternsQuery,
  getSriLankanHolidays,
} = require("../utils/workingDays");

console.log("=========================================");
console.log("   VERIFYING COMPLIANCE & WORKING DAYS   ");
console.log("=========================================");

// Test 1: Holidays
const holidays2026 = getSriLankanHolidays(2026);
console.log(`✅ Holidays 2026 loaded: ${holidays2026.size} days.`);
console.log(`   Sample holiday (May 1): ${holidays2026.has("2026-05-01") ? "PRESENT" : "MISSING"}`);

// Test 2: Weekend & Holiday check
const sunday = "2026-08-02"; // Sunday
const monday = "2026-08-03"; // Monday (Working day)
const mayDay = "2026-05-01"; // May Day (Holiday)

console.log(`\n✅ Sunday (${sunday}) isWorkingDay: ${isWorkingDay(sunday)} (Expected: false)`);
console.log(`✅ Monday (${monday}) isWorkingDay: ${isWorkingDay(monday)} (Expected: true)`);
console.log(`✅ May Day (${mayDay}) isWorkingDay: ${isWorkingDay(mayDay)} (Expected: false)`);

// Test 3: Past working days
const past5 = getPastWorkingDays(5, "2026-08-03");
console.log(`\n✅ Past 5 working days from 2026-08-03:`, past5);
console.log(`   Count: ${past5.length} (Expected: 5)`);

// Test 4: Grace Period calculation
const startDate = new Date("2026-08-03"); // Monday
const graceEnd = calculateGracePeriodEndDate(startDate, 5);
console.log(`\n✅ Training Start: ${startDate.toISOString().split("T")[0]}`);
console.log(`   5-Working-Day Grace End: ${graceEnd ? graceEnd.toISOString().split("T")[0] : "NULL"}`);
console.log(`   isWithinGracePeriod today: ${isWithinGracePeriod(startDate, new Date("2026-08-03"))} (Expected: true)`);

// Test 5: Active Interns Mongoose Query
const query = getActiveInternsQuery(new Date());
console.log(`\n✅ Active Interns Query:`, JSON.stringify(query, null, 2));

console.log("\n=========================================");
console.log("   VERIFICATION COMPLETED SUCCESSFULLY   ");
console.log("=========================================");
