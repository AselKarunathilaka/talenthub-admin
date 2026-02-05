const LeaveRequest = require("../models/LeaveRequest");

class LeaveRequestRepository {
  async create(leaveRequestData) {
    const leaveRequest = new LeaveRequest(leaveRequestData);
    return await leaveRequest.save();
  }

  async findById(id) {
    return await LeaveRequest.findById(id)
      .populate("intern", "Trainee_Name Trainee_ID Trainee_Email")
      .populate("reviewedBy", "name email");
  }

  async findByInternId(internId, options = {}) {
    const { status, limit, skip } = options;
    let query = LeaveRequest.find({ intern: internId });

    if (status) {
      query = query.where("status").equals(status);
    }

    if (skip) {
      query = query.skip(skip);
    }

    if (limit) {
      query = query.limit(limit);
    }

    return await query
      .sort({ submittedAt: -1 })
      .populate("reviewedBy", "name email");
  }

  async findAll(options = {}) {
    const { status, limit, skip, startDate, endDate } = options;
    let query = LeaveRequest.find();

    if (status) {
      query = query.where("status").equals(status);
    }

    //Improved date filtering with proper end-of-day handling
    if (startDate || endDate) {
      const dateFilter = {};

      if (startDate) {
        // Start of the day for startDate
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.$gte = start;
      }

      if (endDate) {
        // End of the day for endDate
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }

      query = query.where("leaveDate", dateFilter);

      console.log("Date filter applied:", {
        startDate: dateFilter.$gte,
        endDate: dateFilter.$lte,
      });
    }

    if (skip) {
      query = query.skip(skip);
    }

    if (limit) {
      query = query.limit(limit);
    }

    return await query
      .sort({ submittedAt: -1 })
      .populate("intern", "Trainee_Name Trainee_ID Trainee_Email")
      .populate("reviewedBy", "name email");
  }

  async updateStatus(id, status, adminResponse, reviewedBy) {
    return await LeaveRequest.findByIdAndUpdate(
      id,
      {
        status,
        adminResponse,
        reviewedBy,
        reviewedAt: new Date(),
      },
      { new: true },
    )
      .populate("intern", "Trainee_Name Trainee_ID Trainee_Email")
      .populate("reviewedBy", "name email");
  }

  async countByInternId(internId, status = null) {
    const query = { intern: internId };
    if (status) {
      query.status = status;
    }
    return await LeaveRequest.countDocuments(query);
  }

  // Add date filtering to countAll method
  async countAll(status = null, options = {}) {
    const { startDate, endDate } = options;
    const query = {};

    if (status) {
      query.status = status;
    }

    // Add date filtering to count as well
    if (startDate || endDate) {
      const dateFilter = {};

      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }

      query.leaveDate = dateFilter;
    }

    return await LeaveRequest.countDocuments(query);
  }

  async delete(id) {
    return await LeaveRequest.findByIdAndDelete(id);
  }
}

module.exports = new LeaveRequestRepository();
