import React, { useState, useEffect } from "react";
import { FaPlus, FaTimes, FaCalendarAlt } from "react-icons/fa";
import axios from "axios";
import Swal from "sweetalert2";
import Navigation from "../components/Navigation";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const Availability = () => {
  const traineeId = localStorage.getItem("internId");
  const [selectedDays, setSelectedDays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!traineeId) return;
    const fetchAvailability = async () => {
      setIsLoading(true);
      try {
        const res = await axios.get(
          `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/page/${traineeId}`
        );
        setSelectedDays(res.data.availableDays || []);
      } catch (error) {
        console.error("Error fetching availability:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to load availability data",
          target: document.body,
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAvailability();
  }, [traineeId]);

  const toggleDay = async (day) => {
    if (!traineeId || isLoading) return;

    const isAlreadyAdded = selectedDays.includes(day);
    setIsLoading(true);

    try {
      if (isAlreadyAdded) {
        await axios.post(
          `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/availability/remove`,
          { day }
        );
        setSelectedDays(selectedDays.filter((d) => d !== day));
        showToast(`${day} removed`, "success");
      } else {
        await axios.post(
          `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${traineeId}/availability/add`,
          { day }
        );
        setSelectedDays([...selectedDays, day]);
        showToast(`${day} added`, "success");
      }
    } catch (error) {
      console.error("Error updating availability:", error);
      showToast("Failed to update availability", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (message, icon) => {
    Swal.fire({
      icon,
      title: message,
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: true,
      target: document.body,
      showClass: {
        popup: 'animate__animated animate__fadeInDown animate__faster'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp animate__faster'
      }
    });
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 24 
      }
    }
  };

  const chipVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: "spring", 
        stiffness: 500, 
        damping: 25 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8, 
      transition: { 
        duration: 0.2 
      }
    }
  };

  const pulseAnimation = {
    scale: [1, 1.05, 1],
    transition: { 
      duration: 0.4,
      repeat: Infinity,
      repeatType: "reverse"
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full min-h-screen bg-white">
      <Navigation />

      <div className="flex-1 w-full p-4 md:p-6 lg:mt-20">
        <main className="mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-xl shadow-sm p-6 sm:p-8"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex items-center justify-center mb-8"
            >
              <motion.div
                animate={isLoading ? pulseAnimation : {}}
              >
                <FaCalendarAlt className="text-blue-600 text-2xl mr-3" />
              </motion.div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                Set Your Availability
              </h1>
            </motion.div>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-gray-600 text-center mb-8 max-w-md mx-auto"
            >
              Select the days you're available for internship activities. Tap on
              a day to add or remove it.
            </motion.p>

            {isLoading && !selectedDays.length ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center justify-center mt-8"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="h-10 w-10 text-blue-600 mb-3" />
                </motion.div>
                <motion.p 
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-gray-600 font-medium"
                >
                  Loading your data...
                </motion.p>
              </motion.div>
            ) : (
              <>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8"
                >
                  {days.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <motion.button
                        key={day}
                        variants={itemVariants}
                        onClick={() => toggleDay(day)}
                        disabled={isLoading}
                        whileHover={!isLoading ? { scale: 1.03 } : {}}
                        whileTap={!isLoading ? { scale: 0.97 } : {}}
                        className={`flex items-center justify-center p-4 rounded-lg transition-all border-2
                          ${
                            isSelected
                              ? "bg-blue-50 border-blue-500 text-blue-700"
                              : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                          }
                          ${
                            isLoading
                              ? "opacity-70 cursor-not-allowed"
                              : "cursor-pointer"
                          }
                          focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50
                        `}
                      >
                        <span className="font-medium">{day}</span>
                        {isSelected ? (
                          <motion.div 
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <FaTimes className="ml-2 text-blue-600" />
                          </motion.div>
                        ) : (
                          <motion.div 
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <FaPlus className="ml-2 text-gray-500" />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.5 }}
                  className="bg-blue-50 rounded-xl p-6 border border-blue-100"
                >
                  <h2 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
                    <FaCalendarAlt className="mr-2" />
                    Your Selected Days
                  </h2>
                  {selectedDays.length === 0 ? (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                      className="text-gray-500 italic"
                    >
                      No days selected yet
                    </motion.p>
                  ) : (
                    <motion.div 
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      className="flex flex-wrap gap-2"
                    >
                      <AnimatePresence>
                        {selectedDays.map((day) => (
                          <motion.span
                            key={day}
                            variants={chipVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout
                            className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center"
                          >
                            {day}
                            <motion.button
                              onClick={() => toggleDay(day)}
                              disabled={isLoading}
                              whileHover={{ scale: 1.2, backgroundColor: "rgba(255,255,255,0.2)" }}
                              whileTap={{ scale: 0.9 }}
                              className="ml-2 p-1 rounded-full hover:bg-blue-700 focus:outline-none"
                            >
                              <FaTimes className="text-xs" />
                            </motion.button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </motion.div>
              </>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Availability;