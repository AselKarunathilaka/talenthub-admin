const DatabaseBackupManager = require("../services/databaseBackupManager");

const requester = (req) => req.admin?.email || req.user?.email || req.user?.id || "super_admin";

async function getBackupStatus(_req, res, next) {
  try {
    res.json(await DatabaseBackupManager.getStatus());
  } catch (error) {
    next(error);
  }
}

function createBackup(req, res, next) {
  try {
    const operation = DatabaseBackupManager.startBackup(requester(req));
    res.status(202).json({ message: "Full database backup started.", operation });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    next(error);
  }
}

module.exports = { createBackup, getBackupStatus };
