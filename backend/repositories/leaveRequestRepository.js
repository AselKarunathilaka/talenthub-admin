const LeaveRequest = require('../models/LeaveRequest');

class LeaveRequestRepository {
  async create(leaveRequestData) {
    const leaveRequest = new LeaveRequest(leaveRequestData);
    return await leaveRequest.save();
  }

  async findById(id) {
    return await LeaveRequest.findById(id)
      .populate('intern', 'firstName lastName nic email')
      .populate('reviewedBy', 'name email');
  }

  async findByInternId(internId, options = {}) {
    const { status, limit, skip } = options;
    let query = LeaveRequest.find({ intern: internId });
    
    if (status) {
      query = query.where('status').equals(status);
    }
    
    if (skip) {
      query = query.skip(skip);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return await query
      .sort({ submittedAt: -1 })
      .populate('reviewedBy', 'name email');
  }

  async findAll(options = {}) {
    const { status, limit, skip, startDate, endDate } = options;
    let query = LeaveRequest.find();
    
    if (status) {
      query = query.where('status').equals(status);
    }
    
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      query = query.where('leaveDate', dateFilter);
    }
    
    if (skip) {
      query = query.skip(skip);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return await query
      .sort({ submittedAt: -1 })
      .populate('intern', 'firstName lastName nic email')
      .populate('reviewedBy', 'name email');
  }

  async updateStatus(id, status, adminResponse, reviewedBy) {
    return await LeaveRequest.findByIdAndUpdate(
      id,
      {
        status,
        adminResponse,
        reviewedBy,
        reviewedAt: new Date()
      },
      { new: true }
    ).populate('intern', 'firstName lastName nic email')
     .populate('reviewedBy', 'name email');
  }

  async countByInternId(internId, status = null) {
    const query = { intern: internId };
    if (status) {
      query.status = status;
    }
    return await LeaveRequest.countDocuments(query);
  }

  async countAll(status = null) {
    const query = status ? { status } : {};
    return await LeaveRequest.countDocuments(query);
  }

  async delete(id) {
    return await LeaveRequest.findByIdAndDelete(id);
  }
}

module.exports = new LeaveRequestRepository();
