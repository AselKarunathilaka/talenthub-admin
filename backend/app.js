const express = require("express");
const cors = require("cors");

const connectDB = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const internRoutes = require("./routes/internRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const projectRoutes = require("./routes/projectRoutes");
const qrCodeRoutes = require("./routes/qrCodeRoutes");
const onlineAttendanceRoutes = require("./routes/onlineAttendanceRoutes");

const app = express();

connectDB();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      allowedOrigins.length > 0
        ? allowedOrigins
        : true,
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "API is working" });
});

app.use("/api/auth", authRoutes);
app.use("/api/interns", internRoutes);
app.use("/api/qrcode", qrCodeRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/online-attendance", onlineAttendanceRoutes);

module.exports = app;