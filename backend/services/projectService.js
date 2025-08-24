const Project = require("../models/Project");

class ProjectService {
  // Create a new project
  async createProject(data) {
    const { projectName, description, internIds, groupNames } = data;

    const newProject = new Project({
      projectName,
      description,
      team: groupNames.join(", "),  // Store group names as a string if required
      tasks: [],
      milestones: [],
      feedback: [],
      notes: [],
      startDate: new Date(),
      endDate: null,
      status: "Active",
    });

    return await newProject.save();
  }

  // Get all projects
  async getAllProjects() {
    return await Project.find().populate('tasks.assignedTo').populate('milestones').populate('feedback').populate('notes');
  }

  // Get a project by ID (including milestones, feedback, and notes)
  async getProjectById(projectId) {
    return await Project.findById(projectId)
      .populate('milestones')
      .populate('feedback')
      .populate('notes');
  }

  // Update project details (start date, end date, status)
  async updateProjectDetails(projectId, { startDate, endDate, status }) {
    const project = await Project.findByIdAndUpdate(
      projectId,
      { startDate, endDate, status },
      { new: true }
    );
    return project;
  }

  // Add milestone to project
  async addMilestoneToProject(projectId, milestoneData) {
    const project = await Project.findById(projectId);
    if (!project) throw new Error("Project not found");

    project.milestones.push(milestoneData);
    return await project.save();
  }

  // Update milestone status in project
  async updateMilestoneStatus(projectId, milestoneId, status) {
    const project = await Project.findById(projectId);
    if (!project) throw new Error("Project not found");

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) throw new Error("Milestone not found");

    milestone.status = status;
    return await project.save();
  }

  // Add feedback to project
  async addFeedbackToProject(projectId, feedbackData) {
    const project = await Project.findById(projectId);
    if (!project) throw new Error("Project not found");

    project.feedback.push(feedbackData);
    return await project.save();
  }

  // Add note to project
  async addNoteToProject(projectId, noteData) {
    const project = await Project.findById(projectId);
    if (!project) throw new Error("Project not found");

    project.notes.push(noteData);
    return await project.save();
  }
}

module.exports = new ProjectService();
