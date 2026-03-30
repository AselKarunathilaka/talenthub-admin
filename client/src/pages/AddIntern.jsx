import { useState, useEffect } from 'react';
import { api, getAuthHeaders } from "../api/apiConfig";
import { BadgeCheck, User, Briefcase, PlusCircle, Loader2, ChevronDown } from 'lucide-react';
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { Toaster, toast } from "react-hot-toast";

const AddIntern = () => {
  const [Trainee_ID, setTraineeId] = useState("");
  const [Trainee_Name, setTraineeName] = useState("");
  const [field_of_spec_name, setFieldOfSpecialization] = useState("");
  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInterns = async () => {
      try {
        const response = await api.get("/interns", getAuthHeaders());
        const fetchedInterns = response.data || [];
        const uniqueSpecializations = Array.from(
          new Set(fetchedInterns.map((intern) => intern.field_of_spec_name).filter(Boolean))
        ).sort();
        setSpecializations(uniqueSpecializations);
      } catch (error) {
        console.error("Error fetching specializations:", error);
        toast.error("Failed to load specializations.");
      }
    };

    fetchInterns();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!Trainee_ID || !Trainee_Name || !field_of_spec_name) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(
        "/interns/add",
        { Trainee_ID, Trainee_Name, field_of_spec_name },
        getAuthHeaders()
      );

      if (response.status === 201) {
        toast.success("Intern added successfully!");
        setTraineeId("");
        setTraineeName("");
        setFieldOfSpecialization("");
      }
    } catch (error) {
      console.error("Error adding intern:", error);
      toast.error("Error adding intern.");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Fixed position for Navbar to ensure it doesn't affect layout flow */}
        <div className="fixed top-0 left-0 right-0 z-10">
          <Navbar />
        </div>
        
        {/* Main Content Area with significant top margin to clear navbar */}
        <div className="flex-1 overflow-y-auto p-6 mt-32">
          <div className="max-w-3xl mx-auto">
            {/* Page Header */}
            <div className="flex items-center mb-8">
              <div className="bg-emerald-50 p-3 rounded-full mr-4">
                <User className="text-emerald-600" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Add New Intern</h1>
                <p className="text-gray-500 text-sm mt-1">Enter intern details to register them in the system</p>
              </div>
            </div>

            {/* Card Container */}
            <div className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Trainee ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trainee ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <BadgeCheck className="text-gray-400" size={18} />
                    </div>
                    <input
                      type="text"
                      value={traineeId}
                      onChange={(e) => setTraineeId(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none sm:text-sm bg-white transition-all duration-200"
                      required
                      placeholder="Enter trainee ID"
                    />
                  </div>
                </div>

                {/* Trainee Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trainee Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="text-gray-400" size={18} />
                    </div>
                    <input
                      type="text"
                      value={traineeName}
                      onChange={(e) => setTraineeName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none sm:text-sm bg-white transition-all duration-200"
                      required
                      placeholder="Enter trainee name"
                    />
                  </div>
                </div>

                {/* Field of Specialization */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Field of Specialization <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="text-gray-400" size={18} />
                    </div>
                    <select
                      value={fieldOfSpecialization}
                      onChange={(e) => setFieldOfSpecialization(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none sm:text-sm bg-white appearance-none cursor-pointer transition-all duration-200"
                      required
                    >
                      <option value="" disabled>Select specialization</option>
                      {specializations.map((spec, index) => (
                        <option key={index} value={spec}>{spec}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all duration-200 flex items-center justify-center"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="animate-spin mr-2" size={18} />
                    ) : (
                      <PlusCircle size={18} className="mr-2" />
                    )}
                    {loading ? "Adding..." : "Add Intern"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '8px',
          },
          success: {
            icon: '✅',
          },
          error: {
            icon: '❌',
          },
        }}
      />
    </div>
  );
};

export default AddIntern;