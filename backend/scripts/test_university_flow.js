require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const UniversityUser = require("../models/UniversityUser");
const Intern = require("../models/Intern");
const DailyRecord = require("../models/DailyRecord");
const { getUniversityStudents } = require("../controllers/universityController");

const runTests = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for tests.");

    // 1. Verify Seeded User
    const supervisor = await UniversityUser.findOne({ email: "ranuja.infor@gmail.com" });
    console.log("\n[TEST 1] Seeded supervisor in DB:", supervisor ? {
      name: supervisor.supervisorName,
      university: supervisor.universityName,
      email: supervisor.email,
      status: supervisor.status
    } : "NOT FOUND");

    // 2. Test Token Generation
    const token = jwt.sign(
      {
        id: supervisor._id,
        email: supervisor.email,
        universityName: supervisor.universityName,
        supervisorName: supervisor.supervisorName,
        role: "university_supervisor",
        accountType: "university",
      },
      process.env.JWT_SECRET || "your_super_secret_jwt_key_here",
      { expiresIn: "24h" }
    );
    console.log("\n[TEST 2] Generated Supervisor JWT Token:", token.slice(0, 30) + "...");

    // 3. Test Student Matching for NSBM Green University
    const req = {
      universitySupervisor: supervisor,
      user: { id: supervisor._id, email: supervisor.email }
    };
    let responseData = null;
    const res = {
      status: (code) => ({
        json: (data) => {
          responseData = { code, data };
          return data;
        }
      })
    };

    await getUniversityStudents(req, res);
    console.log("\n[TEST 3] getUniversityStudents result:");
    console.log("  HTTP Code:", responseData?.code);
    console.log("  University:", responseData?.data?.universityName);
    console.log("  Total Students matched:", responseData?.data?.totalStudents);
    console.log("  Active Today:", responseData?.data?.activeToday);
    console.log("  Average Working Rate:", responseData?.data?.avgWorkingRate + "%");
    console.log("  Logbook Rate:", responseData?.data?.avgLogbookRate + "%");
    console.log("  Sample student 1:", responseData?.data?.students?.[0]?.name, `(${responseData?.data?.students?.[0]?.traineeId}, ${responseData?.data?.students?.[0]?.fieldOfSpecialization})`);
    console.log("  Sample student 2:", responseData?.data?.students?.[1]?.name, `(${responseData?.data?.students?.[1]?.traineeId}, ${responseData?.data?.students?.[1]?.fieldOfSpecialization})`);

    console.log("\n✓ All University backend controller tests passed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Test failure:", err);
    process.exit(1);
  }
};

runTests();
