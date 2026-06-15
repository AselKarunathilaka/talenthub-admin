const express = require("express");
const cors = require("cors");
const path = require("path");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const internRoutes = require("./routes/internRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const projectRoutes = require("./routes/projectRoutes");
const qrCodeRoutes = require("./routes/qrCodeRoutes");
const faceAttendanceRoutes = require("./routes/faceAttendanceRoutes");
const dailyRecordRoutes = require("./routes/dailyRecordRoutes");
const adminRoutes = require("./routes/adminRoutes");
const complianceRoutes = require("./routes/complianceRoutes");
const leaveRequestRoutes = require("./routes/leaveRequestRoutes");
const seatBookingRoutes = require("./routes/seatBookingRoutes");
const gateStaffRoutes = require("./routes/gateStaffRoutes");
const adminSeatRoutes = require("./routes/adminSeatRoutes");
const internAnnouncementRoutes = require("./routes/internAnnouncementRoutes");
const inactiveInternRoutes = require("./routes/inactiveInternRoutes");
const certificateVerifyRoutes = require("./routes/certificateVerifyRoutes");
const logBookRestrictionRoutes = require("./routes/logBookRestrictionroutes");

require("./scheduler");

if (!process.env.TALENTHUB_FEDERATION_SECRET) {
  console.error("CRITICAL: TALENTHUB_FEDERATION_SECRET not configured!");
  process.exit(1);
}

const app = express();

// Middleware
// app.use(cors());
app.use(cors({ origin: "*" }));
// app.use(helmet());

// Increase JSON payload limit to handle longer logbook entries
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
app.use("/api/face-attendance", faceAttendanceRoutes);
app.use("/api/face", faceAttendanceRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/records", dailyRecordRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);
app.use("/api/seat-reservation", seatBookingRoutes);
app.use("/api/gate-staff", gateStaffRoutes);
app.use("/api/admin", adminSeatRoutes);
app.use("/api/announcements", internAnnouncementRoutes);
app.use("/api/inactive-interns", inactiveInternRoutes);
app.use("/api/verify", certificateVerifyRoutes);
app.use("/api/admin/logbook-restrictions", logBookRestrictionRoutes);

module.exports = app;
