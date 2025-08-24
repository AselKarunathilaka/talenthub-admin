const ProjectService = require("../services/projectService");

// Create a new project
const createProject = async (req, res) => {
  try {
    const { projectName, description, internIds, groupNames } = req.body;
    
    // Validate if either internIds or groupNames are provided
    if (!internIds.length && !groupNames.length) {
      return res.status(400).json({ message: "Please provide at least one intern or group for the project." });
    }

    const newProject = await ProjectService.createProject({
      projectName,
      description,
      internIds,
      groupNames,
    });

    res.status(201).json({ message: "Project created successfully!", project: newProject });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ message: "Error creating project", error: error.message });
  }
};

// Get all projects
const getAllProjects = async (req, res) => {
  try {
    const projects = await ProjectService.getAllProjects();
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: "Error fetching projects", error: error.message });
  }
};

// Get project by ID
const getProjectById = async (req, res) => {
  try {
    const project = await ProjectService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: "Error fetching project", error: error.message });
  }
};

// New route to get project overview (including milestones, feedback, and notes)
const getProjectOverview = async (req, res) => {
  try {
    const project = await ProjectService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: "Error fetching project details", error: error.message });
  }
};

// Update project details (start date, end date, status)
const updateProjectDetails = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.body;
    const updatedProject = await ProjectService.updateProjectDetails(req.params.id, { startDate, endDate, status });
    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: "Error updating project details", error: error.message });
  }
};

// Add milestone to project
const addMilestoneToProject = async (req, res) => {
  try {
    const { milestoneData } = req.body;
    const updatedProject = await ProjectService.addMilestoneToProject(req.params.id, milestoneData);
    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: "Error adding milestone", error: error.message });
  }
};

// Update milestone status
const updateMilestoneStatus = async (req, res) => {
  try {
    const { milestoneId, status } = req.body;
    const updatedProject = await ProjectService.updateMilestoneStatus(req.params.id, milestoneId, status);
    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: "Error updating milestone status", error: error.message });
  }
};

// Add feedback to project
const addFeedbackToProject = async (req, res) => {
  try {
    const { feedbackData } = req.body;
    const updatedProject = await ProjectService.addFeedbackToProject(req.params.id, feedbackData);
    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: "Error adding feedback", error: error.message });
  }
};

// Add note to project
const addNoteToProject = async (req, res) => {
  try {
    const { noteData } = req.body;
    const updatedProject = await ProjectService.addNoteToProject(req.params.id, noteData);
    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ message: "Error adding note", error: error.message });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  getProjectOverview, 
  updateProjectDetails, 
  addMilestoneToProject,
  updateMilestoneStatus,
  addFeedbackToProject,
  addNoteToProject,
};
