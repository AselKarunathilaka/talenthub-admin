import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { FaShieldAlt, FaTasks, FaBook, FaChartLine } from "react-icons/fa";
import { api } from "../utils/api";
import logo from "../assets/sltlogo.jpg";
import { motion } from "framer-motion";

const Login = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleGoogleLogin = async (response) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await api.post("/auth/google-login", {
        code: response.credential,
      });
  
      if (data.token) {
        localStorage.setItem("internId", data.internId);
        localStorage.setItem("authToken", data.token);
        navigate("/dashboard");  
      } else {
        setError(data.message || "Authentication failed. Please try again.");
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError("Login failed. Please ensure you're using the correct Google account.");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-950 text-gray-100 overflow-hidden">
      {/* Floating background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-80 h-80 rounded-full bg-green-500/10 -top-20 -left-20 animate-float" style={{ animationDelay: "0s" }}></div>
        <div className="absolute w-96 h-96 rounded-full bg-blue-600/10 top-1/4 right-0 animate-float" style={{ animationDelay: "3s" }}></div>
        <div className="absolute w-64 h-64 rounded-full bg-purple-500/10 bottom-20 left-1/4 animate-float" style={{ animationDelay: "6s" }}></div>
        <div className="absolute w-72 h-72 rounded-full bg-cyan-500/10 bottom-0 right-20 animate-float" style={{ animationDelay: "9s" }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
        {/* Left panel - brand showcase (hidden on mobile) */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 to-gray-900/80 backdrop-blur-sm"></div>
          
          <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-12">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mb-12"
            >
              <img 
                src={logo} 
                alt="SLT Mobitel Logo" 
                className="w-48 h-48 object-contain rounded-full border-4 border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-green-400/30"
              />
            </motion.div>
            
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-5xl font-bold text-white mb-6 text-center leading-tight"
            >
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">
                Internship Portal
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-xl text-white/80 text-center max-w-md leading-relaxed mb-12"
            >
              Comprehensive platform for attendance, tasks, and daily progress tracking
            </motion.p>
            
            {/* Feature cards */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="w-full max-w-md space-y-6"
            >
              {[
                {
                  icon: <FaBook className="h-6 w-6" />,
                  title: "Daily Logbook",
                  description: "Track your daily progress, completed tasks, and achievements"
                },
                {
                  icon: <FaTasks className="h-6 w-6" />,
                  title: "Task Management",
                  description: "Log and monitor your daily tasks and accomplishments"
                },
                {
                  icon: (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: "Real-time Tracking",
                  description: "Monitor your attendance with instant updates"
                },
                {
                  icon: <FaChartLine className="h-6 w-6" />,
                  title: "Progress Analytics",
                  description: "View detailed reports of your internship progress"
                }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  whileHover={{ y: -5 }}
                  className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 hover:border-green-400/30 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start">
                    <div className="bg-gradient-to-br from-green-500/20 to-blue-500/20 p-3 rounded-lg mr-4">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                      <p className="text-white/70">{feature.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
        
        {/* Right panel - login form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="w-full lg:w-1/2 flex items-center justify-center p-6"
        >
          <div className="w-full max-w-md">
            {/* Mobile header */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="relative mb-6"
              >
                <img 
                  src={logo} 
                  alt="SLT Mobitel Logo" 
                  className="w-20 h-20 object-contain mx-auto rounded-full border-4 border-white/10 shadow-lg"
                />
              </motion.div>
              
              <motion.h1
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="text-3xl font-bold text-center mb-2"
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">
                  Welcome Back
                </span>
              </motion.h1>
              
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="text-white/70 text-center max-w-xs"
              >
                Sign in to manage your attendance, tasks, and daily logs
              </motion.p>
            </div>
            
            {/* Login card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="bg-gradient-to-r from-green-600/80 to-blue-600/80 p-6">
                <h2 className="text-center text-2xl font-bold text-white">Intern Login</h2>
                <p className="text-center text-white/90 mt-1 text-sm">Access your daily logbook and task tracker</p>
              </div>
              
              <div className="p-6 space-y-6">
                {error && (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-red-500/10 border-l-4 border-red-400 text-red-100 p-4 rounded-md text-sm flex items-start"
                  >
                    <svg className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>{error}</div>
                  </motion.div>
                )}
                
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-600/20 to-green-600/20 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-1">Google Authentication</h3>
                      <p className="text-white/60 text-sm">Use your registered organization email</p>
                    </div>
                    
                    <div className="mt-6 flex justify-center">
                      {isLoading ? (
                        <div className="inline-flex items-center px-6 py-3 rounded-full bg-white/5 border border-white/10">
                          <div className="w-5 h-5 border-t-2 border-b-2 border-green-400 rounded-full animate-spin mr-2"></div>
                          <span className="text-white/80 text-sm font-medium">Authenticating...</span>
                        </div>
                      ) : (
                        <GoogleLogin
                          onSuccess={handleGoogleLogin}
                          onError={() => setError("Google authentication failed. Please try again.")}
                          useOneTap
                          theme="filled_blue"
                          shape="pill"
                          size="large"
                          text="continue_with"
                          locale="en"
                          width="300"
                        />
                      )}
                    </div>
                  </div>
                  
                  <div className="text-center space-y-3">
                    <div className="text-white/60 text-sm">
                      Having trouble?{' '}
                      <a href="#" className="text-green-400 hover:text-green-300 transition-colors font-medium">
                        Contact support
                      </a>
                    </div>
                    
                    {/* Admin Login Link */}
                    <div className="border-t border-white/10 pt-4">
                      <button
                        onClick={() => navigate('/admin-login')}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200 group cursor-pointer"
                      >
                        <FaShieldAlt className="mr-2 text-blue-400 group-hover:text-blue-300 transition-colors" />
                        Login as Admin
                      </button>
                      <p className="text-xs text-white/50 mt-2">
                        For administrators and supervisors only
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            
            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              className="mt-8 text-center text-white/50 text-sm"
            >
              <div className="flex justify-center space-x-4 mb-2">
                <a href="#" className="hover:text-green-400 transition-colors">Privacy</a>
                <a href="#" className="hover:text-green-400 transition-colors">Terms</a>
                <a href="#" className="hover:text-green-400 transition-colors">Help</a>
              </div>
              <p>© {new Date().getFullYear()} SLT Mobitel. All rights reserved.</p>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Global styles for animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0) rotate(0deg);
          }
          25% {
            transform: translateY(-20px) translateX(10px) rotate(2deg);
          }
          50% {
            transform: translateY(10px) translateX(-10px) rotate(-2deg);
          }
          75% {
            transform: translateY(-10px) translateX(15px) rotate(1deg);
          }
        }
        .animate-float {
          animation: float 12s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Login;