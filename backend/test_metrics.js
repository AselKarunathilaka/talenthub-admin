const mongoose = require("mongoose");
require("dotenv").config({ path: __dirname + "/.env" });
const Intern = require("./models/Intern");
const DailyRecord = require("./models/DailyRecord");
const { gitCommitsCache } = require("./controllers/adminController");
const internPerfCtrl = require("./controllers/internPerformanceController");
const uniCtrl = require("./controllers/universityController");

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  let perfData = null;
  const resPerf = { json: (data) => { perfData = data; }, status: () => resPerf };
  
  await internPerfCtrl.getInternPerformanceSummary({ query: {} }, resPerf);
  
  const perfMap = new Map();
  if (perfData && perfData.interns) {
    perfData.interns.forEach(i => perfMap.set((i.email || i.traineeId || "").toLowerCase(), i));
  }
  
  let uniData = null;
  const resUni = { json: (data) => { uniData = data; }, status: () => resUni };
  
  const reqUni = { query: { universityName: "NSBM Green University" } };
  await uniCtrl.getUniversityStudents(reqUni, resUni);
  
  if (uniData && uniData.students) {
    let diffs = 0;
    uniData.students.forEach(st => {
      if (st.status === "active") {
        const perf = perfMap.get((st.email || st.traineeId || "").toLowerCase());
        if (perf) {
          if (st.qualityScore !== perf.performanceQuality) {
            console.log(`Mismatch for ${st.name}: UniQuality=${st.qualityScore}, PerfQuality=${perf.performanceQuality}`);
            console.log(`  Uni -> daily:${st.dailyAttendanceRate}, meeting:${st.meetingAttendanceRate}, logbookCount:${st.logbookCount}, commitsCount:${st.commitsCount}`);
            console.log(`  Perf-> daily:${perf.dailyAttendanceRate}, meeting:${perf.meetingAttendanceRate}, logbookCount:${perf.logbookEntries}, commitsCount:${perf.commitsCount}, logbookRate:${perf.logbookRate}`);
            diffs++;
          }
        }
      }
    });
    console.log(`Total active students in Uni: ${uniData.students.filter(s=>s.status==="active").length}`);
    console.log(`Total mismatches: ${diffs}`);
  }
  
  process.exit(0);
}
run();
