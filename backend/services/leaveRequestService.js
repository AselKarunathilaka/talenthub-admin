const leaveRequestRepository = require('../repositories/leaveRequestRepository');
const internRepository = require('../repositories/internRepository');
const emailSender = require('../utils/emailSender');
const logger = require('../utils/logger');

class LeaveRequestService {
  async createLeaveRequest(internId, leaveRequestData) {
    try {
      // Get intern details
      const intern = await internRepository.getInternById(internId);
      if (!intern) {
        throw new Error('Intern not found');
      }

      // Validate leave date is not in the past
      const leaveDate = new Date(leaveRequestData.leaveDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (leaveDate < today) {
        throw new Error('Leave date cannot be in the past');
      }

      // Create leave request
      const leaveRequest = await leaveRequestRepository.create({
        intern: internId,
        internName: intern.Trainee_Name || 'Unknown',
        internNIC: intern.Trainee_ID || 'N/A',  // Using Trainee_ID as NIC isn't stored separately
        ...leaveRequestData
      });

      // Send notification email to admin
      await this.notifyAdminNewRequest(leaveRequest);

      console.log(`Leave request created by intern ${internId}`);
      return leaveRequest;
    } catch (error) {
      console.error('Error creating leave request:', error);
      throw error;
    }
  }

  async getLeaveRequestById(id) {
    try {
      const leaveRequest = await leaveRequestRepository.findById(id);
      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }
      return leaveRequest;
    } catch (error) {
      console.error('Error fetching leave request:', error);
      throw error;
    }
  }

  async getLeaveRequestsByIntern(internId, options = {}) {
    try {
      const leaveRequests = await leaveRequestRepository.findByInternId(internId, options);
      const total = await leaveRequestRepository.countByInternId(internId, options.status);
      
      return {
        leaveRequests,
        total,
        page: options.skip ? Math.floor(options.skip / (options.limit || 10)) + 1 : 1,
        totalPages: options.limit ? Math.ceil(total / options.limit) : 1
      };
    } catch (error) {
      console.error('Error fetching leave requests for intern:', error);
      throw error;
    }
  }

  async getAllLeaveRequests(options = {}) {
    try {
      const leaveRequests = await leaveRequestRepository.findAll(options);
      const total = await leaveRequestRepository.countAll(options.status);
      
      return {
        leaveRequests,
        total,
        page: options.skip ? Math.floor(options.skip / (options.limit || 10)) + 1 : 1,
        totalPages: options.limit ? Math.ceil(total / options.limit) : 1
      };
    } catch (error) {
      console.error('Error fetching all leave requests:', error);
      throw error;
    }
  }

  async updateLeaveRequestStatus(id, status, adminResponse, reviewedBy) {
    try {
      // Validate status
      if (!['Approved', 'Denied'].includes(status)) {
        throw new Error('Invalid status. Must be Approved or Denied');
      }

      // Update leave request
      const leaveRequest = await leaveRequestRepository.updateStatus(
        id,
        status,
        adminResponse,
        reviewedBy
      );

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      // Send notification email to intern
      await this.notifyInternStatusUpdate(leaveRequest);

      console.log(`Leave request ${id} updated to ${status} by admin ${reviewedBy}`);
      return leaveRequest;
    } catch (error) {
      console.error('Error updating leave request status:', error);
      throw error;
    }
  }

  async deleteLeaveRequest(id, internId) {
    try {
      const leaveRequest = await leaveRequestRepository.findById(id);
      
      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      // Extract the actual intern ID - could be ObjectId or nested object
      const leaveRequestInternId = leaveRequest.intern._id 
        ? leaveRequest.intern._id.toString() 
        : leaveRequest.intern.toString();
      
      console.log('[Delete] Leave request intern ID:', leaveRequest.intern);
      console.log('[Delete] Extracted intern ID:', leaveRequestInternId);
      console.log('[Delete] Current user intern ID:', internId.toString());

      // Only allow deletion if status is Pending and by the intern who created it
      if (leaveRequest.status !== 'Pending') {
        throw new Error('Cannot delete a leave request that has been reviewed');
      }

      if (leaveRequestInternId !== internId.toString()) {
        throw new Error('Unauthorized to delete this leave request');
      }

      await leaveRequestRepository.delete(id);
      console.log(`Leave request ${id} deleted by intern ${internId}`);
      return { message: 'Leave request deleted successfully' };
    } catch (error) {
      console.error('Error deleting leave request:', error);
      throw error;
    }
  }

  async notifyAdminNewRequest(leaveRequest) {
    try {
      // Get admin emails from environment or configuration
      const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
      
      if (adminEmails.length === 0) {
        console.warn('No admin emails configured for leave request notifications');
        return;
      }

      const subject = `New Leave Request - ${leaveRequest.internName}`;
      const html = `
        <h2>New Leave Permission Request</h2>
        <p>A new leave request has been submitted and requires your review.</p>
        <h3>Details:</h3>
        <ul>
          <li><strong>Intern Name:</strong> ${leaveRequest.internName}</li>
          <li><strong>NIC:</strong> ${leaveRequest.internNIC}</li>
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
      console.error('Error sending admin notification:', error);
      // Don't throw error - notification failure shouldn't block request creation
    }
  }

  async notifyInternStatusUpdate(leaveRequest) {
    try {
      const internEmail = leaveRequest.intern?.email;
      
      if (!internEmail) {
        console.warn('Intern email not available for notification');
        return;
      }

      const statusText = leaveRequest.status === 'Approved' ? 'Approved' : 'Denied';
      const subject = `Leave Request ${statusText} - TalentHub`;
      
      const html = `
        <h2>Leave Request ${statusText}</h2>
        <p>Your leave request has been ${statusText.toLowerCase()}.</p>
        <h3>Request Details:</h3>
        <ul>
          <li><strong>Leave Date:</strong> ${new Date(leaveRequest.leaveDate).toLocaleDateString()}</li>
          <li><strong>Leave Time:</strong> ${leaveRequest.leaveTime}</li>
          <li><strong>Purpose:</strong> ${leaveRequest.purpose}</li>
          <li><strong>Status:</strong> ${leaveRequest.status}</li>
          <li><strong>Reviewed At:</strong> ${new Date(leaveRequest.reviewedAt).toLocaleString()}</li>
        </ul>
        ${leaveRequest.adminResponse ? `<p><strong>Admin Response:</strong> ${leaveRequest.adminResponse}</p>` : ''}
        <p>Please log in to the TalentHub system to view full details.</p>
      `;

      await emailSender.sendEmail(internEmail, subject, html);
      console.log(`Status update notification sent to intern ${leaveRequest.intern._id}`);
    } catch (error) {
      console.error('Error sending intern notification:', error);
      // Don't throw error - notification failure shouldn't block status update
    }
  }
}

module.exports = new LeaveRequestService();
