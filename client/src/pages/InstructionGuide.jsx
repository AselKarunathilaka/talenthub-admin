import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { ClipboardList, CheckCircle, Users, QrCode, Edit2, Upload, Group, ShieldCheck, Search } from "lucide-react";

const instructions = [
  {
    icon: <Users className="text-blue-600 w-5 h-5" />,
    title: "How to Add a New Intern",
    steps: [
      "Go to the 'Add Intern' page from the sidebar.",
      "Fill in the Trainee ID, Name, and Field of Specialization.",
      "Click the 'Add Intern' button.",
      "You'll see a success message when done ✅."
    ]
  },
  {
    icon: <ClipboardList className="text-green-600 w-5 h-5" />,
    title: "How to Mark Attendance",
    steps: [
      "Go to the 'Interns' page.",
      "Find the intern and click ✅ or ❌ based on presence.",
      "Or click on the intern row to view full attendance and mark by date.",
      "Use filters to find past attendance easily."
    ]
  },
  {
    icon: <QrCode className="text-purple-600 w-5 h-5" />,
    title: "How to Generate QR Code for Attendance",
    steps: [
      "Go to the 'QR Code Attendance' page.",
      "Click 'Generate QR Code' to open the scanner modal.",
      "Have interns scan the QR using the mobile app.",
      "Click 'Expire' to stop QR once done."
    ]
  },
  {
    icon: <Upload className="text-indigo-600 w-5 h-5" />,
    title: "How to Upload Interns via Excel",
    steps: [
      "Go to the 'Interns' page.",
      "Select a .xlsx file with trainee details.",
      "Click 'Upload' — all valid interns will be added.",
      "You'll see a success or error message."
    ]
  },
  {
    icon: <Group className="text-rose-500 w-5 h-5" />,
    title: "How to Create a Team",
    steps: [
      "Go to the 'Create Team' page.",
      "Enter a Team Name.",
      "Search and add interns from the list.",
      "Click 'Create Team' when done."
    ]
  },
  {
    icon: <Edit2 className="text-yellow-500 w-5 h-5" />,
    title: "How to Edit or Remove Interns",
    steps: [
      "Click on any intern in the Interns table.",
      "Use 'Edit Profile' to update name/specialization.",
      "Use 'Remove Intern' to delete them from the system."
    ]
  },
  {
    icon: <ShieldCheck className="text-teal-600 w-5 h-5" />,
    title: "How to Manage Teams",
    steps: [
      "Go to the 'Team Management' page.",
      "Search for a team by name.",
      "Use buttons to rename, add, or remove members.",
      "Use trash icon to delete a team."
    ]
  }
];

const InstructionGuide = () => {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter instructions based on search query
  const filteredInstructions = instructions.filter(instruction => 
    instruction.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <div className="h-20" />

        <main className="p-6 mt-5 md:p-10 space-y-8 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-1">📘 User Instruction Guide</h1>
              <p className="text-gray-600 text-md">
                This page provides step-by-step instructions for using the system features.
              </p>
            </div>
            
            {/* Search Bar */}
            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search instructions..."
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Display message when no results */}
          {filteredInstructions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-500">
              <p>No instructions found matching "{searchQuery}"</p>
            </div>
          )}

          {/* Instructions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredInstructions.map((section, index) => (
              <div 
                key={index} 
                className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200"
              >
                <div className="border-b border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white rounded-lg shadow-sm">{section.icon}</div>
                    <h2 className="text-lg font-semibold text-gray-800">{section.title}</h2>
                  </div>
                </div>
                
                <div className="p-5">
                  <h3 className="text-sm font-medium text-gray-500 mb-3">STEPS TO FOLLOW:</h3>
                  <ol className="space-y-3 text-gray-700">
                    {section.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="flex-shrink-0 bg-blue-100 text-blue-600 font-medium rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
};

export default InstructionGuide;