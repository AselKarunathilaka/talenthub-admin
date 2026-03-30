import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/apiConfig";
import { toast } from "react-hot-toast";
import { User, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { Toaster } from "react-hot-toast";
import logo from "../assets/slt logo.jpg";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Handle form submission
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setMessage("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/register", { name, email, password });
      if (response.data.success) {
        toast.success("Registration successful! Please login.");
        navigate("/login");
      } else {
        setMessage(response.data.message || "Registration failed.");
      }
    } catch (error) {
      setMessage("Error during registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-500 to-emerald-500">
      {/* Left side - Illustration/Brand side */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 bg-black/5 backdrop-blur-sm">
        <div className="max-w-md">
          <div className="mb-8">
            <img
              src={logo}
              alt="SLT Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-6">Join the SLT Intern Attendance System</h1>
          <p className="text-white/80 text-lg">
            Create an account to start tracking your attendance, managing your schedule, and connecting with your team.
          </p>
          <div className="mt-12 bg-white/10 p-6 rounded-xl border border-white/20">
            <p className="text-white italic">
              "Our interns represent the future of technology innovation at SLT. We're excited to have you on board."
            </p>
            <p className="text-white/70 mt-4">- SLT HR Department</p>
          </div>
        </div>
      </div>

      {/* Right side - Registration form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex flex-col items-center">
            <img
              src={logo}
              alt="SLT Logo"
              className="h-16 w-auto object-contain mb-4"
            />
            <h2 className="text-white font-bold text-xl">Intern Attendance System</h2>
          </div>

          <div className="bg-white/10 backdrop-blur-md w-full p-8 rounded-2xl shadow-xl border border-white/20">
            <div className="flex items-center mb-6">
              <button 
                onClick={() => navigate("/login")} 
                className="text-white/80 hover:text-white mr-4 p-1 rounded-full hover:bg-white/10 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-3xl font-bold text-white">Create Account</h2>
                <p className="text-white/70">Register with your SLT email</p>
              </div>
            </div>
            
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-white/90 text-sm font-medium pl-1">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all duration-300"
                    required
                    placeholder="Enter your full name"
                  />
                  <User className="absolute left-4 top-3.5 text-white/50" size={20} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white/90 text-sm font-medium pl-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all duration-300"
                    required
                    placeholder="name@slt.lk"
                  />
                  <Mail className="absolute left-4 top-3.5 text-white/50" size={20} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white/90 text-sm font-medium pl-1">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all duration-300"
                    required
                    placeholder="Create a strong password"
                  />
                  <Lock className="absolute left-4 top-3.5 text-white/50" size={20} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-white/90 text-sm font-medium pl-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-12 bg-white/5 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all duration-300"
                    required
                    placeholder="Confirm your password"
                  />
                  <Lock className="absolute left-4 top-3.5 text-white/50" size={20} />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 transform hover:translate-y-[-2px] active:translate-y-[1px] flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <span>Create Account</span>
                )}
              </button>

              {message && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-100 text-center">
                  {message}
                </div>
              )}
            </form>

            <div className="mt-6 text-center">
              <p className="text-white/70">
                Already have an account?{" "}
                <button 
                  onClick={() => navigate("/login")}
                  className="text-emerald-300 hover:text-emerald-200 font-medium"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center text-white/70 text-sm">
            © {new Date().getFullYear()} SLT. All rights reserved.
          </div>
        </div>
      </div>
      <Toaster position="bottom-right" reverseOrder={false} />
    </div>
  );
};

export default Register;