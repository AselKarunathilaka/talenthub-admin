const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const dotenv = require("../config/dotenv");

// Connect to the database
mongoose.connect(dotenv.mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const admins = [
  { email: "jana@slt.com.lk", password: "jana1234" },
  { email: "mgiri@slt.com.lk", password: "slt123" },
];

const insertAdmins = async () => {
  try {
    for (const admin of admins) {
      const hashedPassword = await bcrypt.hash(admin.password, 10);
      const existingUser = await User.findOne({ email: admin.email });

      if (!existingUser) {
        await User.create({ email: admin.email, password: hashedPassword });
        console.log(`Admin ${admin.email} inserted successfully.`);
      } else {
        console.log(`Admin ${admin.email} already exists.`);
      }
    }

    console.log("Admin insertion completed.");
    mongoose.connection.close();
  } catch (error) {
    console.error("Error inserting admins:", error);
    mongoose.connection.close();
  }
};

insertAdmins();
