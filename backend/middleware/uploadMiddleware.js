const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "./uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

// Update the fileFilter to accept XLSX, TXT, and common document types for leave proof
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
    "text/plain", // TXT
    "application/pdf", // PDF
    "image/jpeg", // JPEG
    "image/jpg", // JPG
    "image/png", // PNG
    "application/msword", // DOC
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // DOCX
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type. Allowed types: XLSX, TXT, PDF, JPEG, JPG, PNG, DOC, DOCX"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Limit file size to 5MB
});

module.exports = upload;
