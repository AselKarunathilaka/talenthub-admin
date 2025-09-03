import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaSpinner, FaShieldAlt, FaFingerprint, FaRocket } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL, API_ENDPOINTS } from '../api/apiConfig';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.ADMIN_LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          userType: 'admin'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const adminInfo = {
        token: data.token,
        user: data.user,
        loginTime: new Date().toISOString()
      };

      localStorage.setItem('adminInfo', JSON.stringify(adminInfo));
      navigate('/admin/dashboard');

    } catch (error) {
      console.error('Admin login error:', error);
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = (email, password) => {
    setLoading(true);
    setError('');

    setTimeout(() => {
      const adminInfo = {
        token: 'mock-admin-token-12345',
        user: {
          id: 'admin-001',
          email,
          name: 'Admin User',
          role: 'admin'
        },
        loginTime: new Date().toISOString()
      };

      localStorage.setItem('adminInfo', JSON.stringify(adminInfo));
      navigate('/admin/dashboard');
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-950 text-gray-100 overflow-hidden">
      {/* Floating background elements (same as login) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-80 h-80 rounded-full bg-green-500/10 -top-20 -left-20 animate-float" style={{ animationDelay: "0s" }}></div>
        <div className="absolute w-96 h-96 rounded-full bg-blue-600/10 top-1/4 right-0 animate-float" style={{ animationDelay: "3s" }}></div>
        <div className="absolute w-64 h-64 rounded-full bg-purple-500/10 bottom-20 left-1/4 animate-float" style={{ animationDelay: "6s" }}></div>
        <div className="absolute w-72 h-72 rounded-full bg-cyan-500/10 bottom-0 right-20 animate-float" style={{ animationDelay: "9s" }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <motion.div 
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Glass Morphism Card */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/10">
            {/* Decorative Gradient Bar */}
            <div className="h-2 bg-gradient-to-r from-green-600/80 to-blue-600/80"></div>
            
            {/* Header */}
            <div className="px-10 pt-10 pb-2 text-center">
              <motion.div 
                className="mx-auto mb-6 flex items-center justify-center"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-green-400 rounded-full blur-lg opacity-70 animate-pulse"></div>
                  <div className="relative h-20 w-20 bg-gradient-to-br from-green-400 to-cyan-400 rounded-full flex items-center justify-center shadow-lg">
                    <FaShieldAlt className="h-8 w-8 text-white" />
                  </div>
                </div>
              </motion.div>
              
              <motion.h2 
                className="text-3xl font-bold text-white mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-cyan-400">
                  Admin Portal
                </span>
              </motion.h2>
              <p className="text-sm text-white/80 font-light tracking-wider">
                Secure access to the control center
              </p>
            </div>

            {/* Login Form */}
            <div className="px-10 py-8">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      className="bg-red-500/10 border-l-4 border-red-400 text-red-100 p-4 rounded-md text-sm flex items-start"
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <svg className="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>{error}</div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email Field */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <label htmlFor="email" className="block text-sm font-medium text-white/80 mb-2">
                    Admin Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaUser className="h-5 w-5 text-white/60" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="block w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white placeholder-white/40 transition-all duration-200"
                      placeholder="admin@slt.lk"
                    />
                  </div>
                </motion.div>

                {/* Password Field */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <label htmlFor="password" className="block text-sm font-medium text-white/80 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaLock className="h-5 w-5 text-white/60" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      className="block w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-transparent text-white placeholder-white/40 transition-all duration-200"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <FaEyeSlash className="h-5 w-5 text-white/60 hover:text-white/90 transition-colors" />
                      ) : (
                        <FaEye className="h-5 w-5 text-white/60 hover:text-white/90 transition-colors" />
                      )}
                    </button>
                  </div>
                </motion.div>

                {/* Submit Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <button
                    type="submit"
                    disabled={loading}
                    className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white ${isHovered ? 'bg-gradient-to-r from-green-500 to-cyan-500' : 'bg-gradient-to-r from-green-400 to-cyan-400'} shadow-lg hover:shadow-green-500/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 overflow-hidden cursor-pointer`}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    {loading ? (
                      <div className="flex items-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <FaSpinner className="h-5 w-5 mr-2" />
                        </motion.div>
                        Authenticating...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <FaFingerprint className="h-5 w-5 mr-2 transition-transform group-hover:scale-110" />
                        <span className="tracking-wider">ACCESS ADMIN DASHBOARD</span>
                      </div>
                    )}
                  </button>
                </motion.div>
              </form>
            </div>

            {/* Footer */}
            <div className="px-10 py-4 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-xs text-white/60 hover:text-white/90 font-medium transition-colors cursor-pointer"
              >
                ← Return to Intern Login
              </button>
              <p className="mt-2 text-xs text-white/40">
                SLT Internship Management System • v2.0
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Global styles for animations */}
      <style jsx="true" global="true">{`
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

export default AdminLogin;