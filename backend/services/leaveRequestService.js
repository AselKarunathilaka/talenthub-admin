const leaveRequestRepository = require("../repositories/leaveRequestRepository");
const internRepository = require("../repositories/internRepository");
const emailSender = require("../utils/emailSender");
const PDFDocument = require("pdfkit");
const DailyRecord = require("../models/DailyRecord");

const SLT_LOGO_BASE64 =
  "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";
const SLT_LOGO_BUFFER = Buffer.from(SLT_LOGO_BASE64, "base64");

const TRAINEE_ID_KEYS = ["Trainee_ID", "traineeId", "TraineeId"];

const pickInternField = (source, keys) => {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
};

const getInternTraineeId = (intern) => pickInternField(intern, TRAINEE_ID_KEYS);

const getLeaveTraineeId = (leave) =>
  leave?.intern?.Trainee_ID || leave?.internTraineeId || null;

const formatDateLabel = (value, { includeWeekday = false } = {}) => {
  if (!value) return "Unknown date";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  const options = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };

  if (includeWeekday) {
    options.weekday = "long";
  }

  return date.toLocaleDateString("en-GB", options);
};

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().split("T")[0];
};

const getRequestLabel = (requestType) =>
  requestType === "study_leave" ? "Formal Extended Leave" : "Short Leave";

const getStudyLeaveDates = (leaveRequest) => {
  const start = new Date(leaveRequest.leaveDate);
  const end = new Date(leaveRequest.studyEndDate || leaveRequest.leaveDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

class LeaveRequestService {
  async createLeaveRequest(internId, leaveRequestData) {
    try {
      // Get intern details
      const intern = await internRepository.getInternById(internId);
      if (!intern) {
        throw new Error("Intern not found");
      }

      // Validate leave date is not in the past
      const leaveDate = new Date(leaveRequestData.leaveDate);
      const requestType = leaveRequestData.requestType || "short_leave";
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (leaveDate < today) {
        throw new Error("Leave date cannot be in the past");
      }

      if (requestType === "study_leave") {
        if (!leaveRequestData.proofDocument?.data) {
          throw new Error(
            "Proof document is required for formal extended leave requests",
          );
        }

        const studyEndDate = new Date(
          leaveRequestData.studyEndDate || leaveRequestData.leaveDate,
        );
        studyEndDate.setHours(0, 0, 0, 0);

        leaveDate.setHours(0, 0, 0, 0);

        if (studyEndDate < leaveDate) {
          throw new Error("Extended leave end date cannot be before start date");
        }

        if (leaveRequestData.studyEndDate) {
          leaveRequestData.studyEndDate = studyEndDate;
        } else {
          leaveRequestData.studyEndDate = leaveDate;
        }

        const overlappingStudyLeave =
          await leaveRequestRepository.findOverlappingStudyLeave(
            internId,
            leaveDate,
            studyEndDate,
          );

        if (overlappingStudyLeave) {
          throw new Error(
            "You already have a pending or approved extended leave request for this date range.",
          );
        }
      } else {
        // Validate short leave request time (8:30 AM to 4:30 PM Sri Lanka Time)
        const moment = require("moment");
        const sriLankaNow = moment().utcOffset("+05:30");
        const currentHour = sriLankaNow.hour();
        const currentMinute = sriLankaNow.minute();

        // Check if current time is between 8:30 AM and 4:30 PM
        const isWithinAllowedTime =
          (currentHour === 8 && currentMinute >= 30) ||
          (currentHour > 8 && currentHour < 16) ||
          (currentHour === 16 && currentMinute <= 30);

        if (!isWithinAllowedTime) {
          throw new Error(
            "Short leave requests can only be submitted between 8:30 AM and 4:30 PM Sri Lanka Time",
          );
        }
      }

      // Create leave request
      console.log(
        `Creating leave request for intern: ${internId}, Trainee_ID: ${intern.Trainee_ID}`,
      );

      const leaveRequest = await leaveRequestRepository.create({
        intern: internId,
        internName: intern.Trainee_Name || "Unknown",
        internTraineeId: intern.Trainee_ID || null,
        ...leaveRequestData,
      });

      // NOTE: Individual notification emails are disabled
      // All short leave requests are sent together at 1 PM via scheduled email
      // await this.notifyAdminNewRequest(leaveRequest);

      console.log(
        `Leave request created by intern ${internId}, stored Trainee_ID: ${leaveRequest.internTraineeId}`,
      );
      return leaveRequest;
    } catch (error) {
      console.error("Error creating leave request:", error);
      throw error;
    }
  }

  async getApprovedLeavesByDate(date) {
    return await leaveRequestRepository.findAll({
      status: "Approved",
      date: date,
      requestType: "short_leave",
    });
  }

  async generateApprovedLeavesPDF({ date }) {
    const leaveRequests = await this.getApprovedLeavesByDate(date);
    const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
    const chunks = [];

    doc.on("data", (chunk) => {
      chunks.push(chunk);
    });

    const pdfBuffer = new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    // Add SLT Logo
    if (SLT_LOGO_BUFFER) {
      doc.image(SLT_LOGO_BUFFER, {
        fit: [120, 80],
        align: "center",
      });
      doc.moveDown(2);
    }

    // Report Title - Use standard PDF fonts
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#0b5394")
      .text("Approved Short Leave Requests Report", { align: "center" });

    doc.moveDown(0.5);

    // Date Information
    const dateLabel = date
      ? formatDateLabel(date)
      : formatDateLabel(new Date());
    doc
      .fontSize(12)
      .font("Helvetica")
      .fillColor("black")
      .text(`Report Date: ${dateLabel}`, { align: "center" });

    doc
      .fontSize(10)
      .fillColor("#666666")
      .text(`Generated on: ${formatDateLabel(new Date())}`, {
        align: "center",
      });

    doc.moveDown(1);

    // Summary Statistics
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("black")
      .text(`Total Approved Requests: ${leaveRequests.length}`, {
        align: "center",
      });

    doc.moveDown(1.5);

    // Check if there are any approved requests
    if (leaveRequests.length === 0) {
      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#666666")
        .text(
          "No approved short leave requests were recorded for the selected date.",
          { align: "center" },
        );

      doc.flushPages();
      doc.end();
      return await pdfBuffer;
    }

    // Table configuration
    const tableTop = doc.y;
    const tableLeft = 40;
    const rowHeight = 30;
    const pageHeight = doc.page.height - 80;

    // Column widths
    const colWidths = {
      no: 30,
      name: 110,
      nationalId: 85,
      time: 65,
      purpose: 60,
      reason: 165,
    };

    // Function to draw table header
    const drawTableHeader = (yPosition) => {
      // Draw header background
      doc.rect(tableLeft, yPosition, 515, 25).fill("#0b5394");

      // Set font - use standard font with bold style
      doc.fontSize(10).font("Helvetica-Bold").fillColor("white");

      let xPos = tableLeft + 5;

      // Draw header text
      doc.text("No.", xPos, yPosition + 8, {
        width: colWidths.no,
        align: "center",
      });
      xPos += colWidths.no;

      doc.text("Intern Name", xPos, yPosition + 8, {
        width: colWidths.name,
        align: "left",
      });
      xPos += colWidths.name;

      doc.text("National ID", xPos, yPosition + 8, {
        width: colWidths.nationalId,
        align: "left",
      });
      xPos += colWidths.nationalId;

      doc.text("Time", xPos, yPosition + 8, {
        width: colWidths.time,
        align: "left",
      });
      xPos += colWidths.time;

      doc.text("Purpose", xPos, yPosition + 8, {
        width: colWidths.purpose,
        align: "left",
      });
      xPos += colWidths.purpose;

      doc.text("Reason", xPos, yPosition + 8, {
        width: colWidths.reason,
        align: "left",
      });

      // Reset to regular font for table rows
      doc.font("Helvetica").fillColor("black");

      return yPosition + 25;
    };

    // Draw first header
    let currentY = drawTableHeader(tableTop);

    // Draw table rows
    leaveRequests.forEach((leave, index) => {
      // Check if we need a new page
      if (currentY + rowHeight > pageHeight) {
        doc.addPage();
        currentY = drawTableHeader(40);
      }

      // Extract data
      const internName =
        leave.intern?.Trainee_Name || leave.internName || "Unknown";
      const nationalId = leave.nationalId || "N/A";
      const time = leave.leaveTime || "N/A";
      const purpose = leave.purpose || "N/A";
      const reason = leave.reason || "N/A";

      // Alternate row colors
      const rowColor = index % 2 === 0 ? "#f5f5f5" : "#ffffff";
      doc.rect(tableLeft, currentY, 515, rowHeight).fill(rowColor);

      // Row data
      doc.fontSize(9).fillColor("black");
      let xPos = tableLeft + 5;

      // Serial Number
      doc.text((index + 1).toString(), xPos, currentY + 10, {
        width: colWidths.no,
        align: "center",
      });
      xPos += colWidths.no;

      // Intern Name
      doc.text(internName, xPos, currentY + 10, {
        width: colWidths.name,
        align: "left",
      });
      xPos += colWidths.name;

      // National ID
      doc.text(nationalId, xPos, currentY + 10, {
        width: colWidths.nationalId,
        align: "left",
      });
      xPos += colWidths.nationalId;

      // Time
      doc.text(time, xPos, currentY + 10, {
        width: colWidths.time,
        align: "left",
      });
      xPos += colWidths.time;

      // Purpose
      doc.text(purpose, xPos, currentY + 10, {
        width: colWidths.purpose,
        align: "left",
      });
      xPos += colWidths.purpose;

      // Reason (with ellipsis if too long)
      const truncatedReason =
        reason.length > 80 ? reason.substring(0, 77) + "..." : reason;
      doc.text(truncatedReason, xPos, currentY + 10, {
        width: colWidths.reason,
        align: "left",
      });

      currentY += rowHeight;
    });

    // Footer with page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Footer line
      doc
        .moveTo(40, doc.page.height - 50)
        .lineTo(doc.page.width - 40, doc.page.height - 50)
        .stroke("#cccccc");

      // Page number
      doc
        .fontSize(9)
        .fillColor("#666666")
        .text(
          `Page ${i + 1} of ${pages.count}`,
          doc.page.width / 2,
          doc.page.height - 40,
          {
            align: "center",
          },
        );
    }

    doc.flushPages();
    doc.end();
    return await pdfBuffer;
  }

  async getLeaveRequestById(id) {
    try {
      const leaveRequest = await leaveRequestRepository.findById(id);
      if (!leaveRequest) {
        throw new Error("Leave request not found");
      }
      return leaveRequest;
    } catch (error) {
      console.error("Error fetching leave request:", error);
      throw error;
    }
  }

  async getLeaveRequestsByIntern(internId, options = {}) {
    try {
      const leaveRequests = await leaveRequestRepository.findByInternId(
        internId,
        options,
      );
      const total = await leaveRequestRepository.countByInternId(
        internId,
        options.status,
        { date: options.date, requestType: options.requestType },
      );

      return {
        leaveRequests,
        total,
        page: options.skip
          ? Math.floor(options.skip / (options.limit || 10)) + 1
          : 1,
        totalPages: options.limit ? Math.ceil(total / options.limit) : 1,
      };
    } catch (error) {
      console.error("Error fetching leave requests for intern:", error);
      throw error;
    }
  }

  async getAllLeaveRequests(options = {}) {
    try {
      const leaveRequests = await leaveRequestRepository.findAll(options);

      // UPDATED: Pass date options to countAll method
      const total = await leaveRequestRepository.countAll(options.status, {
        date: options.date,
        submittedDate: options.submittedDate,
        requestType: options.requestType,
      });

      return {
        leaveRequests,
        total,
        page: options.skip
          ? Math.floor(options.skip / (options.limit || 10)) + 1
          : 1,
        totalPages: options.limit ? Math.ceil(total / options.limit) : 1,
      };
    } catch (error) {
      console.error("Error fetching all leave requests:", error);
      throw error;
    }
  }

  async updateLeaveRequestStatus(id, status, adminResponse, reviewedBy) {
    try {
      // Validate status
      if (!["Approved", "Denied"].includes(status)) {
        throw new Error("Invalid status. Must be Approved or Denied");
      }

      // Update leave request
      const leaveRequest = await leaveRequestRepository.updateStatus(
        id,
        status,
        adminResponse,
        reviewedBy,
      );

      if (!leaveRequest) {
        throw new Error("Leave request not found");
      }

      // Send notification email to intern
      await this.notifyInternStatusUpdate(leaveRequest);

      console.log(
        `Leave request ${id} updated to ${status} by admin ${reviewedBy}`,
      );
      return leaveRequest;
    } catch (error) {
      console.error("Error updating leave request status:", error);
      throw error;
    }
  }

  async deleteLeaveRequest(id, internId) {
    try {
      const leaveRequest = await leaveRequestRepository.findById(id);

      if (!leaveRequest) {
        throw new Error("Leave request not found");
      }

      // Extract the actual intern ID - could be ObjectId or nested object
      const leaveRequestInternId = leaveRequest.intern._id
        ? leaveRequest.intern._id.toString()
        : leaveRequest.intern.toString();

      console.log("[Delete] Leave request intern ID:", leaveRequest.intern);
      console.log("[Delete] Extracted intern ID:", leaveRequestInternId);
      console.log("[Delete] Current user intern ID:", internId.toString());

      // Only allow deletion if status is Pending and by the intern who created it
      if (leaveRequest.status !== "Pending") {
        throw new Error("Cannot delete a leave request that has been reviewed");
      }

      if (leaveRequestInternId !== internId.toString()) {
        throw new Error("Unauthorized to delete this leave request");
      }

      await leaveRequestRepository.delete(id);
      console.log(`Leave request ${id} deleted by intern ${internId}`);
      return { message: "Leave request deleted successfully" };
    } catch (error) {
      console.error("Error deleting leave request:", error);
      throw error;
    }
  }

  async notifyAdminNewRequest(leaveRequest) {
    try {
      // Get admin emails from environment or configuration
      const adminEmails = process.env.ADMIN_EMAILS
        ? process.env.ADMIN_EMAILS.split(",")
        : [];

      if (adminEmails.length === 0) {
        console.warn(
          "No admin emails configured for leave request notifications",
        );
        return;
      }

      const subject = `New Short Leave Request - ${leaveRequest.internName}`;
      const html = `
        <h2>New Short Leave Permission Request</h2>
        <p>A new short leave request has been submitted and requires your review.</p>
        <h3>Details:</h3>
        <ul>
          <li><strong>Intern Name:</strong> ${leaveRequest.internName}</li>
          <li><strong>Trainee ID:</strong> ${leaveRequest.internTraineeId || "N/A"}</li>
          <li><strong>Leave Date:</strong> ${new Date(leaveRequest.leaveDate).toLocaleDateString()}</li>
          <li><strong>Leave Time:</strong> ${leaveRequest.leaveTime}</li>
          <li><strong>Purpose:</strong> ${leaveRequest.purpose}</li>
          <li><strong>Reason:</strong> ${leaveRequest.reason}</li>
          <li><strong>Submitted At:</strong> ${new Date(leaveRequest.submittedAt).toLocaleString()}</li>
        </ul>
        <p>Please log in to the TalentHub system to review and process this request.</p>
      `;

      for (const email of adminEmails) {
        await emailSender.sendEmail(email.trim(), subject, html);
      }

      console.log(`Leave request notification sent to admins`);
    } catch (error) {
      console.error("Error sending admin notification:", error);
      // Don't throw error - notification failure shouldn't block request creation
    }
  }

  async notifyInternStatusUpdate(leaveRequest) {
    try {
      const internEmail = leaveRequest.intern?.email;

      if (!internEmail) {
        console.warn("Intern email not available for notification");
        return;
      }

      const statusText =
        leaveRequest.status === "Approved" ? "Approved" : "Denied";
      const requestLabel = getRequestLabel(leaveRequest.requestType);
      const subject = `${requestLabel} Request ${statusText} - TalentHub`;

      const html = `
        <h2>${requestLabel} Request ${statusText}</h2>
        <p>Your ${requestLabel.toLowerCase()} request has been ${statusText.toLowerCase()}.</p>
        <h3>Request Details:</h3>
        <ul>
          <li><strong>Leave Date:</strong> ${new Date(leaveRequest.leaveDate).toLocaleDateString()}</li>
          ${leaveRequest.requestType === "study_leave" && leaveRequest.studyEndDate ? `<li><strong>End Date:</strong> ${new Date(leaveRequest.studyEndDate).toLocaleDateString()}</li>` : ""}
          <li><strong>Leave Time:</strong> ${leaveRequest.leaveTime}</li>
          <li><strong>Purpose:</strong> ${leaveRequest.purpose}</li>
          <li><strong>Status:</strong> ${leaveRequest.status}</li>
          <li><strong>Reviewed At:</strong> ${new Date(leaveRequest.reviewedAt).toLocaleString()}</li>
        </ul>
        ${leaveRequest.adminResponse ? `<p><strong>Admin Response:</strong> ${leaveRequest.adminResponse}</p>` : ""}
        <p>Please log in to the TalentHub system to view full details.</p>
      `;

      await emailSender.sendEmail(internEmail, subject, html);
      console.log(
        `Status update notification sent to intern ${leaveRequest.intern._id}`,
      );
    } catch (error) {
      console.error("Error sending intern notification:", error);
      // Don't throw error - notification failure shouldn't block status update
    }
  }

  async updateLeaveRequestStatus(id, status, adminResponse, reviewedBy) {
    try {
      // Validate status
      if (!["Approved", "Denied"].includes(status)) {
        throw new Error("Invalid status. Must be Approved or Denied");
      }

      // Update leave request
      const leaveRequest = await leaveRequestRepository.updateStatus(
        id,
        status,
        adminResponse,
        reviewedBy,
      );

      if (!leaveRequest) {
        throw new Error("Leave request not found");
      }

      // Generate pass token only for short leave passes.
      if (
        status === "Approved" &&
        leaveRequest.requestType !== "study_leave" &&
        !leaveRequest.passToken
      ) {
        leaveRequest.generatePassToken();
        await leaveRequest.save();
      }

      if (status === "Approved" && leaveRequest.requestType === "study_leave") {
        await this.syncApprovedStudyLeaveToLogbook(leaveRequest);
      }

      // Send notification email to intern
      await this.notifyInternStatusUpdate(leaveRequest);

      console.log(
        `Leave request ${id} updated to ${status} by admin ${reviewedBy}`,
      );

      return leaveRequest;
    } catch (error) {
      console.error("Error updating leave request status:", error);
      throw error;
    }
  }

  async syncApprovedStudyLeaveToLogbook(leaveRequest) {
    const dates = getStudyLeaveDates(leaveRequest);

    for (const date of dates) {
      await DailyRecord.findOneAndUpdate(
        {
          internId: leaveRequest.intern._id || leaveRequest.intern,
          date,
        },
        {
          $set: {
            stack: "Formal Extended Leave",
            task: `Formal extended leave approved. Reason: ${leaveRequest.reason}`,
            progress: "Approved extended leave with proof document submitted.",
            blockers: "No work progress recorded due to formal extended leave.",
            status: "study_leave",
            attendance: "absent",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  // Add new method to validate leave pass
  async validateLeavePass(token) {
    try {
      const leaveRequest = await leaveRequestRepository.findByToken(token);

      if (!leaveRequest) {
        return {
          valid: false,
          reason: "Invalid leave pass",
        };
      }

      if (leaveRequest.status !== "Approved") {
        return {
          valid: false,
          reason: "Leave not approved",
        };
      }

      if (leaveRequest.passUsed) {
        return {
          valid: false,
          reason: "Pass already used",
          usedAt: leaveRequest.passUsedAt,
        };
      }

      // Check if leave date is today (Sri Lanka timezone)
      const sriLankaTime = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Colombo",
      });
      const currentDate = new Date(sriLankaTime);
      const leaveDate = new Date(leaveRequest.leaveDate);

      const isSameDay =
        currentDate.getFullYear() === leaveDate.getFullYear() &&
        currentDate.getMonth() === leaveDate.getMonth() &&
        currentDate.getDate() === leaveDate.getDate();

      if (!isSameDay) {
        return {
          valid: false,
          reason: "Pass is not valid for today",
          leaveDate: leaveRequest.leaveDate,
        };
      }

      // Check if current time is past 4:30 PM Sri Lanka time
      const currentHour = currentDate.getHours();
      const currentMinute = currentDate.getMinutes();
      const isPastExpiry =
        currentHour > 16 || (currentHour === 16 && currentMinute >= 30);

      if (isPastExpiry) {
        return {
          valid: false,
          reason: "Pass expired (after 4:30 PM)",
          expired: true,
        };
      }

      // Pass is valid
      return {
        valid: true,
        leaveRequest: {
          internName: leaveRequest.internName,
          traineeId: leaveRequest.internTraineeId,
          nationalId: leaveRequest.nationalId,
          leaveDate: leaveRequest.leaveDate,
          leaveTime: leaveRequest.leaveTime,
          purpose: leaveRequest.purpose,
          reason: leaveRequest.reason,
          reviewedBy: leaveRequest.reviewedBy,
          reviewedAt: leaveRequest.reviewedAt,
        },
      };
    } catch (error) {
      console.error("Error validating leave pass:", error);
      throw error;
    }
  }

  // Add new method to mark pass as used
  async markPassAsUsed(token) {
    try {
      const leaveRequest = await leaveRequestRepository.findByToken(token);

      if (!leaveRequest) {
        throw new Error("Leave pass not found");
      }

      if (leaveRequest.passUsed) {
        throw new Error("Pass already marked as used");
      }

      leaveRequest.passUsed = true;
      leaveRequest.passUsedAt = new Date();
      await leaveRequest.save();

      return {
        success: true,
        message: "Exit marked successfully",
        usedAt: leaveRequest.passUsedAt,
      };
    } catch (error) {
      console.error("Error marking pass as used:", error);
      throw error;
    }
  }
}

module.exports = new LeaveRequestService();
