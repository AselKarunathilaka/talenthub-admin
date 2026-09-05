const jwt = require("jsonwebtoken");
const dotenv = require("../config/dotenv");
const UniversityUser = require("../models/UniversityUser");

const universityAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided, authorization denied" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, dotenv.jwtSecret);

    // If supervisor role
    if (decoded.accountType === "university" || decoded.role === "university_supervisor") {
      const supervisor = await UniversityUser.findById(decoded.id);
      if (!supervisor) {
        return res.status(401).json({ message: "University supervisor account not found" });
      }

      if (supervisor.status !== "approved") {
        return res.status(403).json({
          message: `Access denied. Your account status is currently ${supervisor.status}.`,
          status: supervisor.status,
        });
      }

      req.universitySupervisor = supervisor;
      req.user = {
        id: supervisor._id,
        email: supervisor.email,
        name: supervisor.supervisorName,
        universityName: supervisor.universityName,
        role: "university_supervisor",
        accountType: "university",
      };
      return next();
    }

    // If admin
    if (decoded.accountType === "admin" || decoded.role === "super_admin" || decoded.role === "admin") {
      req.user = decoded;
      return next();
    }

    return res.status(403).json({ message: "Access forbidden for this account type" });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired, please login again", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Invalid authentication token" });
  }
};

module.exports = universityAuth;
