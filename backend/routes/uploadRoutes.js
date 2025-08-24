const express = require("express");
const router = express.Router();
const { uploadFile } = require("../controllers/uploadController");
const upload = require("../middleware/uploadMiddleware");

router.post("/upload", upload.single("file"), uploadFile);

module.exports = router;
