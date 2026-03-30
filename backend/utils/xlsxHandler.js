const xlsx = require("xlsx");
const Intern = require("../models/Intern");

// ✅ Helper to parse only the date (ignore time) using dd/mm/yyyy format
const parseDateOnly = (value) => {
  if (!value) return null;

  // Handle Excel date numbers
  if (typeof value === "number") {
    const excelDate = xlsx.SSF.parse_date_code(value);
    // Create date in local timezone without time component
    return new Date(excelDate.y, excelDate.m - 1, excelDate.d);
  }

  // Handle string dates (dd/mm/yyyy format)
  if (typeof value === "string") {
    const dateStr = value.split(" ")[0].trim(); // Remove time part if exists
    const parts = dateStr.split(/[/-]/);

    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-based month
      const year = parseInt(parts[2], 10);

      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        // Create date in local timezone without time component
        const date = new Date(year, month, day);
        // Adjust for timezone offset to prevent date shifting
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date;
      }
    }
  }

  return null;
};

// ✅ Parse Excel file into JSON objects
const parseXLSX = (filePath) => {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Skip first two rows (slice(2)) and process from third row onwards
    return jsonData.slice(2).map((row) => {
      // Process trainee ID by removing "T00" prefix
      const formattedTraineeId = row[0] ? String(row[0]).replace(/^T00/, '') : '';
      
      return {
        traineeId: formattedTraineeId,
        traineeName: row[1] || '',
        email: row[2] || '',
        trainingStartDate: parseDateOnly(row[3]),
        trainingEndDate: parseDateOnly(row[4]),
        institute: row[5] || '',
        fieldOfSpecialization: row[6] || ''
      };
    });
  } catch (error) {
    console.error("Error parsing XLSX file:", error);
    throw new Error("Error processing file");
  }
};

// ✅ Upload interns to MongoDB
const addInternsFromXLSX = async (interns) => {
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let deletedCount = 0;

  const uploadedTraineeIds = interns
    .filter((intern) => intern.traineeId)
    .map((intern) => intern.traineeId);

  // Delete interns not in the current file
  const deleteResult = await Intern.deleteMany({
    traineeId: { $nin: uploadedTraineeIds },
  });
  deletedCount = deleteResult.deletedCount;

  // Process each intern
  for (const intern of interns) {
    // Validate required fields
    if (
      !intern.traineeId ||
      !intern.traineeName ||
      !intern.fieldOfSpecialization
    ) {

      skippedCount++;
      continue;
    }

    try {
      // Prepare complete intern data according to your schema
      const internData = {
        traineeId: intern.traineeId,
        traineeName: intern.traineeName,
        fieldOfSpecialization: intern.fieldOfSpecialization,
        trainingStartDate: intern.trainingStartDate || null,
        trainingEndDate: intern.trainingEndDate || null,
        institute: intern.institute || "",
        email: intern.email || "",
        team: "", // Initialize empty team
        // attendance and availableDays will use their defaults
      };

      // Use findOneAndUpdate with upsert instead of separate create/update
      const result = await Intern.findOneAndUpdate(
        { traineeId: intern.traineeId },
        internData,
        { upsert: true, new: true, runValidators: true }
      );

      if (result.upserted) {
        addedCount++;
      } else {
        updatedCount++;
      }
    } catch (error) {
      console.error(
        `Error processing intern ${intern.traineeId}:`,
        error.message
      );
      skippedCount++;
    }
  }


  return { addedCount, updatedCount, skippedCount, deletedCount };
};

module.exports = { parseXLSX, addInternsFromXLSX };
