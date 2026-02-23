import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { motion } from "framer-motion";
import { FaMapMarkerAlt, FaArrowLeft, FaUsers } from "react-icons/fa";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Fix default marker icon issue */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const AdminInternLocations = () => {
  const navigate = useNavigate();

  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = import.meta.env.VITE_BACKEND_URL;
  const fetchInternLocations = useCallback(async (token) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.get(
        `${API_BASE}/admin/intern-locations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.data.success) {
        const validInterns = res.data.data.filter(
          (i) =>
            i.coordinates &&
            Array.isArray(i.coordinates) &&
            i.coordinates.length === 2
        );

        setInterns(validInterns);
      } else {
        setError("Invalid response from server");
      }
    } catch (err) {
      console.error("Location fetch error:", err);
      setError("Failed to fetch intern locations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");

    if (!adminInfo.token) {
      setError("Admin authentication required");
      navigate("/admin-login");
      return;
    }

    fetchInternLocations(adminInfo.token);

    const interval = setInterval(() => {
      fetchInternLocations(adminInfo.token);
    }, 300000);

    return () => clearInterval(interval);
  }, [fetchInternLocations, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 text-gray-800">

      <main className="p-6 lg:p-8 max-w-7xl mx-auto">

        {/* HEADER SECTION */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-6"
        >

          {/* Left Side */}
          <div>
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="mb-4 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-sm transition-all duration-200"
            >
              <FaArrowLeft className="inline mr-2 text-gray-600" />
              Back to Dashboard
            </button>

            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-3 rounded-xl">
                <FaMapMarkerAlt className="text-blue-600 text-xl" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-800">
                  Intern Locations
                </h2>
                <p className="text-gray-500 text-sm">
                  Live overview of all registered intern locations
                </p>
              </div>
            </div>
          </div>

          {/* Right Side – Intern Count Card */}
          <motion.div
            whileHover={{ scale: 1.03 }}
            className="flex items-center gap-4 bg-white px-6 py-5 rounded-2xl shadow-md border border-gray-100"
          >
            <div className="bg-blue-500 text-white p-4 rounded-xl shadow-lg">
              <FaUsers className="text-2xl" />
            </div>

            <div>
              <p className="text-sm text-gray-500">
                Total Interns with Location
              </p>
              <p className="text-3xl font-bold text-blue-600">
                {interns.length}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* ERROR MESSAGE */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl mb-6"
          >
            {error}
          </motion.div>
        )}

        {/* MAP CONTAINER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-gray-500 text-sm">
                Loading intern locations...
              </p>
            </div>
          ) : (
            <MapContainer
              center={[7.8731, 80.7718]}
              zoom={8}
              style={{ height: "650px", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {interns.map((intern) => (
                <Marker
                  key={intern.id}
                  position={[
                    intern.coordinates[1],
                    intern.coordinates[0],
                  ]}
                >
                  <Popup>
                    <div className="text-sm space-y-1">
                      <p className="font-semibold text-gray-800">
                        {intern.name}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">ID:</span> {intern.id}
                      </p>
                      <p className="text-gray-600">
                        {intern.address}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </motion.div>

      </main>
    </div>
  );
};

export default AdminInternLocations;