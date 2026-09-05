require("dotenv").config();
const mongoose = require("mongoose");
const UniversityUser = require("../models/UniversityUser");

const seedUniversity = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for seeding university user...");

    const email = "ranuja.infor@gmail.com".toLowerCase().trim();
    const universityName = "NSBM Green University";
    const supervisorName = "Ranuja Liyanaarachchi";

    let supervisor = await UniversityUser.findOne({ email });

    if (!supervisor) {
      supervisor = new UniversityUser({
        universityName,
        supervisorName,
        email,
        department: "Faculty of Computing",
        designation: "Academic Supervisor / Internship Coordinator",
        contactNumber: "+94 77 123 4567",
        status: "approved",
        approvedAt: new Date(),
        approvedBy: "System Administrator",
        requestedAt: new Date(),
        notes: "Initial seed supervisor account",
      });
      await supervisor.save();
      console.log(`✓ Successfully seeded university supervisor: ${supervisorName} (${universityName}, ${email}) with status: approved`);
    } else {
      supervisor.universityName = universityName;
      supervisor.supervisorName = supervisorName;
      supervisor.status = "approved";
      supervisor.approvedAt = supervisor.approvedAt || new Date();
      supervisor.approvedBy = supervisor.approvedBy || "System Administrator";
      await supervisor.save();
      console.log(`✓ Updated existing university supervisor: ${supervisorName} (${universityName}, ${email}) to status: approved`);
    }

    const allSupervisors = await UniversityUser.find({});
    console.log(`Total university supervisors in DB: ${allSupervisors.length}`);
    console.log(allSupervisors.map(s => ({ name: s.supervisorName, university: s.universityName, email: s.email, status: s.status })));

    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedUniversity();
