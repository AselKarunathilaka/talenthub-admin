const path = require("path");
const { parseXLSX, addInternsFromXLSX } = require("../utils/xlsxHandler");

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    if (fileExtension !== ".xlsx") {
      return res.status(400).json({ message: "Invalid file format. Only XLSX files are allowed." });
    }

    const interns = await parseXLSX(filePath);
    await addInternsFromXLSX(interns);

    res.status(200).json({ message: "Interns imported successfully!" });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Error processing file", error: error.message });
  }
};

module.exports = { uploadFile };
