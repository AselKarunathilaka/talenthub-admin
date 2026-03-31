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
    const { status, date, limit, skip } = options;
    let query = LeaveRequest.find({ intern: internId });

    if (status) {
      query = query.where("status").equals(status);
    }

    // Date filter: match the leaveDate field to the selected calendar day
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query.where("leaveDate").gte(startOfDay).lte(endOfDay);

      console.log(`[findByInternId] Date filter: ${date}`, {
        startOfDay,
        endOfDay,
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
      .populate("reviewedBy", "name email");
  }

  async findAll(options = {}) {
    const { status, limit, skip, date } = options;
    let query = LeaveRequest.find();

    if (status) {
      query = query.where("status").equals(status);
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query.where("leaveDate", {
        $gte: startOfDay,
        $lte: endOfDay,
      });

      console.log("Date filter applied:", {
        date: date,
        startOfDay: startOfDay,
        endOfDay: endOfDay,
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

  async countByInternId(internId, status = null, options = {}) {
    const { date } = options;
    const query = { intern: internId };

    if (status) {
      query.status = status;
    }

    // Date filter for intern-scoped count
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.leaveDate = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    return await LeaveRequest.countDocuments(query);
  }

  // Add date filtering to countAll method
  async countAll(status = null, options = {}) {
    const { date } = options;
    const query = {};

    if (status) {
      query.status = status;
    }

    // Single date filtering
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.leaveDate = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    return await LeaveRequest.countDocuments(query);
  }

  async delete(id) {
    return await LeaveRequest.findByIdAndDelete(id);
  }

  async findByToken(token) {
    try {
      const leaveRequest = await LeaveRequest.findOne({ passToken: token })
        .populate("intern", "Trainee_Name email Trainee_ID")
        .populate("reviewedBy", "email name");
      return leaveRequest;
    } catch (error) {
      console.error("Error finding leave request by token:", error);
      throw error;
    }
  }
}

module.exports = new LeaveRequestRepository();
