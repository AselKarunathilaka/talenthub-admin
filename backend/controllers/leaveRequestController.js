const leaveRequestService = require('../services/leaveRequestService');
const User = require('../models/User');
const fs = require('fs');

class LeaveRequestController {
  // Create a new leave request (Intern only)
  async createLeaveRequest(req, res, next) {
    try {
      const internId = req.user.internId || req.user.id;
      console.log('[Create] req.user:', JSON.stringify(req.user));
      console.log('[Create] Using internId:', internId);
      const { leaveDate, leaveTime, purpose, reason } = req.body;

      // Validate required fields
      if (!leaveDate || !leaveTime || !purpose || !reason) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required: leaveDate, leaveTime, purpose, reason'
        });
      }

      // Convert uploaded file to base64 if present
      let proofDocument = null;
      if (req.file) {
        const fileData = fs.readFileSync(req.file.path);
        const base64Data = fileData.toString('base64');
        
        proofDocument = {
          data: base64Data,
          contentType: req.file.mimetype,
          filename: req.file.originalname,
          size: req.file.size
        };

        // Delete the temporary file after reading
        fs.unlinkSync(req.file.path);
      }

      const leaveRequest = await leaveRequestService.createLeaveRequest(internId, {
        leaveDate,
        leaveTime,
        purpose,
        reason,
        proofDocument
      });

      res.status(201).json({
        success: true,
        message: 'Leave request submitted successfully',
        data: leaveRequest
      });
    } catch (error) {
      console.error('Error in createLeaveRequest controller:', error);
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
      const isOwner = leaveRequest.intern._id.toString() === req.user.id.toString();

      if (!isAdmin && !isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to access this leave request'
        });
      }

      res.status(200).json({
        success: true,
        data: leaveRequest
      });
    } catch (error) {
      console.error('Error in getLeaveRequestById controller:', error);
      next(error);
    }
  }

  // Get leave requests for logged-in intern
  async getMyLeaveRequests(req, res, next) {
    try {
      const internId = req.user.internId || req.user.id;
      const { status, page = 1, limit = 10 } = req.query;

      const options = {
        status,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit)
      };

      const result = await leaveRequestService.getLeaveRequestsByIntern(internId, options);

      res.status(200).json({
        success: true,
        data: result.leaveRequests,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error in getMyLeaveRequests controller:', error);
      next(error);
    }
  }

  // Get all leave requests (Admin only)
  async getAllLeaveRequests(req, res, next) {
    try {
      // Check if user is admin
      console.log(`[LeaveRequest] Checking admin access for user ID: ${req.user.id}`);
      const adminUser = await User.findById(req.user.id);
      console.log(`[LeaveRequest] Admin user found: ${!!adminUser}`);
      
      if (!adminUser) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { status, page = 1, limit = 10, startDate, endDate } = req.query;

      const options = {
        status,
        startDate,
        endDate,
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit)
      };

      const result = await leaveRequestService.getAllLeaveRequests(options);

      res.status(200).json({
        success: true,
        data: result.leaveRequests,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('[LeaveRequest] Error in getAllLeaveRequests controller:', error);
      next(error);
    }
  }

  // Update leave request status (Admin only)
  async updateLeaveRequestStatus(req, res, next) {
    try {
      // Check if user is admin
      const adminUser = await User.findById(req.user.id);
      if (!adminUser) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { id } = req.params;
      const { status, adminResponse } = req.body;
      const reviewedBy = req.user.id;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const leaveRequest = await leaveRequestService.updateLeaveRequestStatus(
        id,
        status,
        adminResponse,
        reviewedBy
      );

      res.status(200).json({
        success: true,
        message: `Leave request ${status.toLowerCase()} successfully`,
        data: leaveRequest
      });
    } catch (error) {
      console.error('Error in updateLeaveRequestStatus controller:', error);
      next(error);
    }
  }

  // Delete leave request (Intern only, pending requests only)
  async deleteLeaveRequest(req, res, next) {
    try {
      const { id } = req.params;
      console.log('[Delete] req.user:', JSON.stringify(req.user));
      const internId = req.user.internId || req.user.id;
      console.log('[Delete] Using internId:', internId);

      const result = await leaveRequestService.deleteLeaveRequest(id, internId);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error in deleteLeaveRequest controller:', error);
      next(error);
    }
  }

  // Get leave request stats (Admin only)
  async getLeaveRequestStats(req, res, next) {
    try {
      // Check if user is admin
      console.log(`[LeaveRequest] Checking admin access for stats - user ID: ${req.user.id}`);
      const adminUser = await User.findById(req.user.id);
      console.log(`[LeaveRequest] Admin user found for stats: ${!!adminUser}`);
      
      if (!adminUser) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { startDate, endDate } = req.query;

      const [total, pending, approved, denied] = await Promise.all([
        leaveRequestService.getAllLeaveRequests({ startDate, endDate }),
        leaveRequestService.getAllLeaveRequests({ status: 'Pending', startDate, endDate }),
        leaveRequestService.getAllLeaveRequests({ status: 'Approved', startDate, endDate }),
        leaveRequestService.getAllLeaveRequests({ status: 'Denied', startDate, endDate })
      ]);

      res.status(200).json({
        success: true,
        data: {
          total: total.total,
          pending: pending.total,
          approved: approved.total,
          denied: denied.total
        }
      });
    } catch (error) {
      console.error('Error in getLeaveRequestStats controller:', error);
      next(error);
    }
  }

  // Get document for a leave request
  async getLeaveRequestDocument(req, res, next) {
    try {
      const { id } = req.params;
      const leaveRequest = await leaveRequestService.getLeaveRequestById(id);

      if (!leaveRequest || !leaveRequest.proofDocument || !leaveRequest.proofDocument.data) {
        return res.status(404).json({
          success: false,
          message: 'Document not found'
        });
      }

      // Convert base64 back to buffer
      const fileBuffer = Buffer.from(leaveRequest.proofDocument.data, 'base64');

      // Set appropriate headers
      res.setHeader('Content-Type', leaveRequest.proofDocument.contentType);
      res.setHeader('Content-Length', fileBuffer.length);
      res.setHeader('Content-Disposition', `inline; filename="${leaveRequest.proofDocument.filename}"`);

      // Send the file
      res.send(fileBuffer);
    } catch (error) {
      console.error('Error in getLeaveRequestDocument controller:', error);
      next(error);
    }
  }
}

module.exports = new LeaveRequestController();
