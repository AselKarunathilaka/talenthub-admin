const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' },
});

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Intern' }],
  progress: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'Not Started' },
});

const feedbackSchema = new mongoose.Schema({
  internId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intern' },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  comment: { type: String },
  date: { type: Date, default: Date.now },
});

const noteSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  content: { type: String },
  author: { type: String },  // Could be the admin or manager name
  date: { type: Date, default: Date.now },
});

const projectSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  description: { type: String, required: true },
  team: { type: String, required: true }, // Team or Intern
  tasks: [taskSchema],
  milestones: [milestoneSchema],
  feedback: [feedbackSchema],
  notes: [noteSchema],
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['Active', 'Completed', 'On Hold'], default: 'Active' },
});

module.exports = mongoose.model("Project", projectSchema);
