const leaveRequestService = require("../services/leaveRequestService");
const User = require("../models/User");
const fs = require("fs");

class LeaveRequestController {
  // Create a new leave request (Intern only)
  async createLeaveRequest(req, res, next) {
    try {
      const internId = req.user.internId || req.user.id;
      console.log("[Create] req.user:", JSON.stringify(req.user));
      console.log("[Create] Using internId:", internId);
      const {
        leaveDate,
        studyEndDate,
        leaveTime,
        purpose,
        reason,
        nationalId,
        requestType = "short_leave",
      } = req.body;

      // Validate required fields
      if (!leaveDate || !leaveTime || !purpose || !reason || !nationalId) {
        return res.status(400).json({
          success: false,
          message:
            "All fields are required: leaveDate, leaveTime, purpose, reason, National ID",
        });
      }

      if (requestType === "study_leave" && !req.file) {
        return res.status(400).json({
          success: false,
          message: "Proof document is required for formal extended leave requests",
        });
      }

      // Convert uploaded file to base64 if present
      let proofDocument = null;
      if (req.file) {
        const fileData = fs.readFileSync(req.file.path);
        const base64Data = fileData.toString("base64");

        proofDocument = {
          data: base64Data,
          contentType: req.file.mimetype,
          filename: req.file.originalname,
          size: req.file.size,
        };

        // Delete the temporary file after reading
        fs.unlinkSync(req.file.path);
      }

      const leaveRequest = await leaveRequestService.createLeaveRequest(
        internId,
        {
          leaveDate,
          studyEndDate,
          leaveTime,
          nationalId,
          purpose,
          reason,
          proofDocument,
          requestType,
        },
      );

      res.status(201).json({
        success: true,
        message: "Leave request submitted successfully",
        data: leaveRequest,
      });
    } catch (error) {
      console.error("Error in createLeaveRequest controller:", error);
      next(error);
    }
  }

  // Get leave request by ID
  async getLeaveRequestById(req, res, next) {
    try {
      const { id } = req.params;
      const leaveRequest = await leaveRequestService.getLeaveRequestById(id);

      // Authorization check
      const adminUser = await User.findById(req.user.id);
      const isAdmin = !!adminUser;
      const isOwner =
        leaveRequest.intern._id.toString() === req.user.id.toString();

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to access this leave request",
        });
      }

      res.status(200).json({
        success: true,
        data: leaveRequest,
      });
    } catch (error) {
      console.error("Error in getLeaveRequestById controller:", error);
      next(error);
    }
  }

  // Get leave requests for logged-in intern
  async getMyLeaveRequests(req, res, next) {
    try {
      const internId = req.user.internId || req.user.id;
      // Accept `date` param in addition to `status` and pagination
      const { status, date, requestType, page = 1, limit = 10 } = req.query;

      const options = {
        status,
        date, // pass date through to service → repository
        requestType,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
      };

      console.log(
        `[getMyLeaveRequests] internId=${internId} date=${date} status=${status} page=${page}`,
      );

      const result = await leaveRequestService.getLeaveRequestsByIntern(
        internId,
        options,
      );

      res.status(200).json({
        success: true,
        data: result.leaveRequests,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("Error in getMyLeaveRequests controller:", error);
      next(error);
    }
  }

  // Get all leave requests (Admin only)
  async getAllLeaveRequests(req, res, next) {
    try {
      // Check if user is admin
      const adminUser = await User.findById(req.user.id);

      console.log("User.findById result:", adminUser ? "FOUND USER" : "NULL");
      console.log("Full adminUser object:", JSON.stringify(adminUser, null, 2));

      if (!adminUser) {
        console.log("Admin user NOT found - returning 403");
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const {
        status,
        requestType,
        page = 1,
        limit = 10,
        date,
        submittedDate,
      } = req.query;

      const options = {
        status,
        date,
        submittedDate,
        requestType,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
      };

      const result = await leaveRequestService.getAllLeaveRequests(options);
      console.log("Leave requests fetched successfully");

      res.status(200).json({
        success: true,
        data: result.leaveRequests,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      console.error("ERROR in getAllLeaveRequests controller:", error);
      next(error);
    }
  }

  // Update leave request status (Admin only)
  async updateLeaveRequestStatus(req, res, next) {
    try {
      // Check if user is admin
      const adminUser = await User.findById(req.user.id);
      if (!adminUser) {
        return res
          .status(403)
          .json({ success: false, message: "Admin access required" });
      }

      const { id } = req.params;
      const { status, adminResponse } = req.body;
      const reviewedBy = req.user.id;

      if (!status) {
        return res
          .status(400)
          .json({ success: false, message: "Status is required" });
      }

      const leaveRequest = await leaveRequestService.updateLeaveRequestStatus(
        id,
        status,
        adminResponse,
        reviewedBy,
      );

      //No instant email — daily report at 4 PM handles notification

      res.status(200).json({
        success: true,
        message: `Leave request ${status.toLowerCase()} successfully`,
        data: leaveRequest,
      });
    } catch (error) {
      console.error("Error in updateLeaveRequestStatus controller:", error);
      next(error);
    }
  }

  // Delete leave request (Intern only, pending requests only)
  async deleteLeaveRequest(req, res, next) {
    try {
      const { id } = req.params;
      console.log("[Delete] req.user:", JSON.stringify(req.user));
      const internId = req.user.internId || req.user.id;
      console.log("[Delete] Using internId:", internId);

      const result = await leaveRequestService.deleteLeaveRequest(id, internId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error("Error in deleteLeaveRequest controller:", error);
      next(error);
    }
  }

  // Get leave request stats (Admin only)
  async getLeaveRequestStats(req, res, next) {
    try {
      // Check if user is admin
      console.log(
        `[LeaveRequest] Checking admin access for stats - user ID: ${req.user.id}`,
      );
      const adminUser = await User.findById(req.user.id);
      console.log(`[LeaveRequest] Admin user found for stats: ${!!adminUser}`);

      if (!adminUser) {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const { date, submittedDate, requestType } = req.query;

      const [total, pending, approved, denied] = await Promise.all([
        leaveRequestService.getAllLeaveRequests({
          date,
          submittedDate,
          requestType,
        }),
        leaveRequestService.getAllLeaveRequests({
          date,
          submittedDate,
          status: "Pending",
          requestType,
        }),
        leaveRequestService.getAllLeaveRequests({
          date,
          submittedDate,
          status: "Approved",
          requestType,
        }),
        leaveRequestService.getAllLeaveRequests({
          date,
          submittedDate,
          status: "Denied",
          requestType,
        }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          total: total.total,
          pending: pending.total,
          approved: approved.total,
          denied: denied.total,
        },
      });
    } catch (error) {
      console.error("Error in getLeaveRequestStats controller:", error);
      next(error);
    }
  }

  async exportApprovedLeavesPdf(req, res, next) {
    try {
      const adminUser = await User.findById(req.user.id);

      if (!adminUser) {
        return res.status(403).json({
          success: false,
          message: "Admin access required",
        });
      }

      const { date } = req.query;

      if (!date || Number.isNaN(new Date(date).getTime())) {
        return res.status(400).json({
          success: false,
          message: "Valid date query parameter is required",
        });
      }

      const pdfBuffer = await leaveRequestService.generateApprovedLeavesPDF({
        date,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="approved-leaves-report.pdf"',
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error in exportApprovedLeavesPdf controller:", error);
      next(error);
    }
  }

  // Bulk update leave request status (Admin only)
  async bulkUpdateLeaveRequestStatus(req, res, next) {
    try {
      // Check if user is admin
      const adminUser = await User.findById(req.user.id);
      if (!adminUser) {
        return res
          .status(403)
          .json({ success: false, message: "Admin access required" });
      }

      const { requestIds, status, adminResponse } = req.body;
      const reviewedBy = req.user.id;

      if (
        !requestIds ||
        !Array.isArray(requestIds) ||
        requestIds.length === 0
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Request IDs array is required" });
      }
      if (!status) {
        return res
          .status(400)
          .json({ success: false, message: "Status is required" });
      }

      const updatedRequests = [];
      const errors = [];

      for (const requestId of requestIds) {
        try {
          const leaveRequest =
            await leaveRequestService.updateLeaveRequestStatus(
              requestId,
              status,
              adminResponse,
              reviewedBy,
            );
          updatedRequests.push(leaveRequest);
        } catch (error) {
          errors.push({ requestId, error: error.message });
        }
      }

      // No instant email — daily report at 4 PM handles notification

      res.status(200).json({
        success: true,
        message: `Successfully ${status.toLowerCase()} ${updatedRequests.length} leave request(s)`,
        data: {
          updated: updatedRequests.length,
          errors: errors.length,
          details: errors.length > 0 ? errors : undefined,
        },
      });
    } catch (error) {
      console.error("Error in bulkUpdateLeaveRequestStatus controller:", error);
      next(error);
    }
  }

  // Get document for a leave request
  async getLeaveRequestDocument(req, res, next) {
    try {
      const { id } = req.params;
      const leaveRequest = await leaveRequestService.getLeaveRequestById(id);

      if (
        !leaveRequest ||
        !leaveRequest.proofDocument ||
        !leaveRequest.proofDocument.data
      ) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(leaveRequest.proofDocument.data, "base64");

      // Set appropriate headers
      const safeFilename = String(
        leaveRequest.proofDocument.filename || "proof-document",
      ).replace(/["\r\n]/g, "");

      res.setHeader("Content-Type", leaveRequest.proofDocument.contentType);
      res.setHeader("Content-Length", fileBuffer.length);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
      );

      // Send the file
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error in getLeaveRequestDocument controller:", error);
      next(error);
    }
  }

  // Validate leave pass
  async validateLeavePass(req, res, next) {
    try {
      const { token } = req.params;

      const validation = await leaveRequestService.validateLeavePass(token);

      res.status(200).json({
        success: true,
        data: validation,
      });
    } catch (error) {
      console.error("Error in validateLeavePass controller:", error);
      next(error);
    }
  }

  // Mark pass as used
  async markPassAsUsed(req, res, next) {
    try {
      const { token } = req.params;

      const result = await leaveRequestService.markPassAsUsed(token);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("Error in markPassAsUsed controller:", error);
      next(error);
    }
  }

  // Get leave pass by token (for intern to view their own pass)
  async getLeavePassByToken(req, res, next) {
    try {
      const { token } = req.params;

      const validation = await leaveRequestService.validateLeavePass(token);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.reason,
          data: validation,
        });
      }

      res.status(200).json({
        success: true,
        data: validation,
      });
    } catch (error) {
      console.error("Error in getLeavePassByToken controller:", error);
      next(error);
    }
  }
}

module.exports = new LeaveRequestController();
