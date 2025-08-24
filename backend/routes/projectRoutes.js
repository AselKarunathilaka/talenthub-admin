const express = require("express");
const router = express.Router();
const ProjectController = require("../controllers/projectController");

// Create a project
router.post("/create", ProjectController.createProject);

// Get all projects
router.get("/", ProjectController.getAllProjects);

// Get project by ID
router.get("/:id", ProjectController.getProjectById);

// New route to get project overview (including milestones, feedback, and notes)
router.get("/:id/overview", ProjectController.getProjectOverview);

// Update project details (start date, end date, status)
router.put("/:id/update", ProjectController.updateProjectDetails);

// Add milestone to project
router.post("/:id/milestones", ProjectController.addMilestoneToProject);

// Update milestone status
router.put("/:id/milestones/:milestoneId/status", ProjectController.updateMilestoneStatus);

// Add feedback to project
router.post("/:id/feedback", ProjectController.addFeedbackToProject);

// Add note to project
router.post("/:id/notes", ProjectController.addNoteToProject);

module.exports = router;
