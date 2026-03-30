import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/apiConfig";
import { User, Lock, Loader2, UserPlus } from "lucide-react";
import { Toaster } from "react-hot-toast";
import logo from "../assets/slt logo.jpg";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/login", { email, password });
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        navigate("/");
      } else {
        setMessage("Invalid email or password.");
      }
    } catch (error) {
      setMessage("Error logging in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = () => {
    navigate("/register");
  };

  // Function to populate the login fields with predefined credentials
  const handleFillTestCredentials = () => {
    setEmail('admin@slt.lk');
    setPassword('admin@123');
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
          <h1 className="text-4xl font-bold text-white mb-6">Welcome to the SLT Intern Attendance System</h1>
          <p className="text-white/80 text-lg">
            Track your attendance, manage your schedule, and stay connected with your team - all in one place.
          </p>
          <div className="mt-12 bg-white/10 p-6 rounded-xl border border-white/20">
            <p className="text-white italic">
              "The SLT Intern Program helps build the future tech leaders through hands-on experience and mentorship."
            </p>
            <p className="text-white/70 mt-4">- SLT Management</p>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
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
            <h2 className="text-3xl font-bold text-white mb-2">Sign In</h2>
            <p className="text-white/70 mb-8">Use your SLT email to access the system</p>
            
            <form onSubmit={handleLogin} className="space-y-5">
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
                  <User className="absolute left-4 top-3.5 text-white/50" size={20} />
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
                    placeholder="Enter your password"
                  />
                  <Lock className="absolute left-4 top-3.5 text-white/50" size={20} />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 transform hover:translate-y-[-2px] active:translate-y-[1px] flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleRegister}
                  className="w-full bg-transparent border border-white/30 hover:bg-white/10 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2"
                >
                  <UserPlus size={18} />
                  <span>Register New User</span>
                </button>

                {/* Button to populate test credentials */}
                <button
                  type="button"
                  onClick={handleFillTestCredentials}
                  className="w-full bg-transparent border border-white/30 hover:bg-white/10 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2"
                >
                  <span>Fill Admin Credentials</span>
                </button>
              </div>

              {message && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-100 text-center">
                  {message}
                </div>
              )}
            </form>
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

export default Login;
