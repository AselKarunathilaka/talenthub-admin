const mongoose = require("mongoose");
const dotenv = require("./config/dotenv");
const Staff = require("./models/Staff");

mongoose
  .connect(dotenv.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("MongoDB connected");

    const staffMembers = [
      {
        email: "ranuja liyanaarachchi@gmail.com",
        name: "Ranuja Liyanaarachchi",
        role: "Developer",
      },
      {
        email: "wickramasinghetharuka5@gmail.com",
        name: "Tharuka Wickramasinghe",
        role: "Project Manager",
      }
    ];

    for (const staff of staffMembers) {
      // Clean up the email to lowercase and trim
      staff.email = staff.email.trim().toLowerCase();
      
      const existing = await Staff.findOne({ email: staff.email });
      if (!existing) {
        await Staff.create(staff);
        console.log(`Created Staff: ${staff.name} (${staff.email})`);
      } else {
        console.log(`Staff already exists: ${staff.name} (${staff.email})`);
      }
    }

    console.log("Seeding complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Connection error", err);
    process.exit(1);
  });
