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

  async findOverlappingStudyLeave(internId, startDate, endDate) {
    return await LeaveRequest.findOne({
      intern: internId,
      requestType: "study_leave",
      status: { $in: ["Pending", "Approved"] },
      leaveDate: { $lte: endDate },
      studyEndDate: { $gte: startDate },
    }).select("_id").sort({ submittedAt: -1 });
  }

  async findByInternId(internId, options = {}) {
    const { status, date, limit, skip, requestType } = options;
    const filter = { intern: internId };

    if (status) {
      filter.status = status;
    }

    if (requestType) {
      filter.requestType = requestType;
    }

    // Date filter: match the leaveDate field to the selected calendar day
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.$or = [
        { leaveDate: { $gte: startOfDay, $lte: endOfDay } },
        {
          requestType: "study_leave",
          leaveDate: { $lte: endOfDay },
          studyEndDate: { $gte: startOfDay },
        },
      ];

      console.log(`[findByInternId] Date filter: ${date}`, {
        startOfDay,
        endOfDay,
      });
    }

    let query = LeaveRequest.find(filter).select("-proofDocument.data");

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
    const { status, limit, skip, date, submittedDate, requestType } = options;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (requestType) {
      filter.requestType = requestType;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.$or = [
        { leaveDate: { $gte: startOfDay, $lte: endOfDay } },
        {
          requestType: "study_leave",
          leaveDate: { $lte: endOfDay },
          studyEndDate: { $gte: startOfDay },
        },
      ];

      console.log("Date filter applied:", {
        date: date,
        startOfDay: startOfDay,
        endOfDay: endOfDay,
      });
    }

    if (submittedDate) {
      const startOfDay = new Date(submittedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(submittedDate);
      endOfDay.setHours(23, 59, 59, 999);

      filter.submittedAt = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    let query = LeaveRequest.find(filter).select("-proofDocument.data");

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
      .select("-proofDocument.data")
      .populate("intern", "Trainee_Name Trainee_ID Trainee_Email")
      .populate("reviewedBy", "name email");
  }

  async countByInternId(internId, status = null, options = {}) {
    const { date, requestType } = options;
    const query = { intern: internId };

    if (status) {
      query.status = status;
    }

    if (requestType) {
      query.requestType = requestType;
    }

    // Date filter for intern-scoped count
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.$or = [
        { leaveDate: { $gte: startOfDay, $lte: endOfDay } },
        {
          requestType: "study_leave",
          leaveDate: { $lte: endOfDay },
          studyEndDate: { $gte: startOfDay },
        },
      ];
    }

    return await LeaveRequest.countDocuments(query);
  }

  // Add date filtering to countAll method
  async countAll(status = null, options = {}) {
    const { date, submittedDate, requestType } = options;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (requestType) {
      query.requestType = requestType;
    }

    // Single date filtering
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.$or = [
        { leaveDate: { $gte: startOfDay, $lte: endOfDay } },
        {
          requestType: "study_leave",
          leaveDate: { $lte: endOfDay },
          studyEndDate: { $gte: startOfDay },
        },
      ];
    }

    if (submittedDate) {
      const startOfDay = new Date(submittedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(submittedDate);
      endOfDay.setHours(23, 59, 59, 999);

      query.submittedAt = {
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
