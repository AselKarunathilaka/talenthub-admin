const express = require("express");
const cors = require("cors");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");


const authRoutes = require("./routes/authRoutes");
const internRoutes = require("./routes/internRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const projectRoutes = require("./routes/projectRoutes");
const qrCodeRoutes = require("./routes/qrCodeRoutes");
const dailyRecordRoutes = require("./routes/dailyRecordRoutes");
const adminRoutes = require("./routes/adminRoutes");
const complianceRoutes = require("./routes/complianceRoutes");

const app = express();

// Middleware
// app.use(cors());
app.use(cors({ origin: "*" }));
// app.use(helmet());
app.use(express.json());

// // Rate limiting setup
// const apiLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per window
//   message: "Too many requests from this IP, please try again later",
// });

// // Apply rate limiting globally
// app.use(apiLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/interns", internRoutes);
app.use("/api/qrcode", qrCodeRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/records", dailyRecordRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/compliance", complianceRoutes);


module.exports = app;
