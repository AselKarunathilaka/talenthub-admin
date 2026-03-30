import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaMapMarkerAlt,
  FaArrowLeft,
  FaUsers,
  FaSearch,
  FaFilter,
  FaTimes,
  FaExclamationTriangle,
  FaHome,
  FaIdCard,
} from "react-icons/fa";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Leaflet default icon fix ──────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const highlightIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const SRI_LANKA_DISTRICTS = [
  "All",
  "Ampara",
  "Anuradhapura",
  "Badulla",
  "Batticaloa",
  "Colombo",
  "Galle",
  "Gampaha",
  "Hambantota",
  "Jaffna",
  "Kalutara",
  "Kandy",
  "Kegalle",
  "Kilinochchi",
  "Kurunegala",
  "Mannar",
  "Matale",
  "Matara",
  "Monaragala",
  "Mullaitivu",
  "Nuwara Eliya",
  "Polonnaruwa",
  "Puttalam",
  "Ratnapura",
  "Trincomalee",
  "Vavuniya",
];

// ── OMS spiderfy CSS (leg lines + hover) ─────────────────────────────────────
const OMS_CSS = `
  .oms-shadow { stroke: #999; stroke-width: 1; }
  .leaflet-marker-icon { transition: opacity 0.2s; }
`;

// ── FlyTo helper ──────────────────────────────────────────────────────────────
function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 14, { duration: 1.2 });
  }, [position, map]);
  return null;
}

// ── OMS Layer: all markers visible, overlapping ones auto-spiderfied ──────────
function SpiderfyLayer({ interns, highlightedId, onReady }) {
  const map = useMap();
  const omsRef = useRef(null);
  const layerRef = useRef(null);
  const markerMapRef = useRef({});

  useEffect(() => {
    // Dynamically load OMS (attaches to window.OverlappingMarkerSpiderfier)
    const scriptId = "oms-script";

    const init = () => {
      // Clear previous layer
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      if (omsRef.current) {
        omsRef.current.clearMarkers();
      }

      const OMS = window.OverlappingMarkerSpiderfier;
      if (!OMS) return;

      const oms = new OMS(map, {
        markersWontMove: true,
        markersWontHide: true,
        basicFormatEvents: true,
        nearbyDistance: 20, // px — markers within 20px are spiderfied
        spiralFootSeparation: 26,
        spiralLengthStart: 11,
        spiralLengthFactor: 4,
        circleFootSeparation: 30,
        circleStartAngle: Math.PI / 6,
        legWeight: 1.5,
      });

      const layer = L.layerGroup();
      const newMarkerMap = {};

      interns.forEach((intern) => {
        const isHighlighted = intern.id === highlightedId;
        const marker = L.marker(
          [intern.coordinates[1], intern.coordinates[0]],
          {
            icon: isHighlighted ? highlightIcon : new L.Icon.Default(),
            zIndexOffset: isHighlighted ? 1000 : 0,
          },
        );

        const popupContent = `
          <div style="min-width:175px;font-size:13px;line-height:1.6">
            <p style="font-weight:700;color:#1e293b;margin:0 0 4px">${intern.name}</p>
            <p style="color:#475569;margin:0 0 2px">
              <span style="font-weight:600">ID:</span> ${intern.id}
            </p>
            ${
              intern.district
                ? `<p style="color:#475569;margin:0 0 2px">
                   <span style="font-weight:600">District:</span> ${intern.district}
                 </p>`
                : ""
            }
            <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;line-height:1.4">
              ${intern.address || "<em>No address</em>"}
            </p>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 240 });
        oms.addMarker(marker);
        layer.addLayer(marker);
        newMarkerMap[intern.id] = marker;
      });

      map.addLayer(layer);
      layerRef.current = layer;
      omsRef.current = oms;
      markerMapRef.current = newMarkerMap;

      if (onReady) onReady(newMarkerMap);
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/OverlappingMarkerSpiderfier-Leaflet/0.2.6/oms.min.js";
      script.onload = init;
      document.head.appendChild(script);
    } else if (window.OverlappingMarkerSpiderfier) {
      init();
    } else {
      // Script tag exists but hasn't loaded yet — wait
      const script = document.getElementById(scriptId);
      script.addEventListener("load", init, { once: true });
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      if (omsRef.current) {
        omsRef.current.clearMarkers();
        omsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interns, highlightedId]);

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
const AdminInternLocations = () => {
  const navigate = useNavigate();

  const [interns, setInterns] = useState([]);
  const [districtCounts, setDistrictCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedDistrict, setSelectedDistrict] = useState("All");
  const [idSearch, setIdSearch] = useState("");
  const [idSearchLoading, setIdSearchLoading] = useState(false);
  const [idSearchError, setIdSearchError] = useState(null);
  const [highlightedIntern, setHighlightedIntern] = useState(null);
  const [flyTo, setFlyTo] = useState(null);
  const [listSearch, setListSearch] = useState("");

  const markerMapRef = useRef({});
  const API_BASE = import.meta.env.VITE_BACKEND_URL;

  // Inject OMS CSS once
  useEffect(() => {
    if (!document.getElementById("oms-css")) {
      const style = document.createElement("style");
      style.id = "oms-css";
      style.textContent = OMS_CSS;
      document.head.appendChild(style);
    }
  }, []);

  const fetchInternLocations = useCallback(
    async (token, district = "All") => {
      try {
        setLoading(true);
        setError(null);
        const params = district !== "All" ? { district } : {};
        const res = await axios.get(`${API_BASE}/admin/intern-locations`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        });
        if (res.data.success) {
          const valid = res.data.data.filter(
            (i) =>
              i.coordinates &&
              Array.isArray(i.coordinates) &&
              i.coordinates.length === 2 &&
              i.coordinates[0] != null &&
              i.coordinates[1] != null,
          );
          setInterns(valid);
        } else {
          setError("Invalid response from server");
        }
      } catch {
        setError("Failed to fetch intern locations");
      } finally {
        setLoading(false);
      }
    },
    [API_BASE],
  );

  const fetchDistrictCounts = useCallback(
    async (token) => {
      try {
        const res = await axios.get(`${API_BASE}/admin/district-counts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) setDistrictCounts(res.data.data);
      } catch {}
    },
    [API_BASE],
  );

  useEffect(() => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (!adminInfo.token) {
      navigate("/admin-login");
      return;
    }
    fetchInternLocations(adminInfo.token, "All");
    fetchDistrictCounts(adminInfo.token);
    const iv = setInterval(
      () => fetchInternLocations(adminInfo.token, selectedDistrict),
      300000,
    );
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (!adminInfo.token) return;
    setHighlightedIntern(null);
    setFlyTo(null);
    setListSearch("");
    fetchInternLocations(adminInfo.token, selectedDistrict);
  }, [selectedDistrict, fetchInternLocations]);

  const handleIdSearch = async () => {
    const trimmed = idSearch.trim();
    if (!trimmed) {
      setHighlightedIntern(null);
      setFlyTo(null);
      setIdSearchError(null);
      return;
    }

    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    setIdSearchLoading(true);
    setIdSearchError(null);

    try {
      const res = await axios.get(
        `${API_BASE}/admin/intern-location/${encodeURIComponent(trimmed)}`,
        { headers: { Authorization: `Bearer ${adminInfo.token}` } },
      );
      if (res.data.success && res.data.data) {
        const intern = res.data.data;
        if (!intern.coordinates || intern.coordinates.length !== 2) {
          setIdSearchError(
            `Intern "${intern.name}" found but has no location data.`,
          );
          setHighlightedIntern(null);
          setFlyTo(null);
        } else {
          setHighlightedIntern(intern);
          setFlyTo([intern.coordinates[1], intern.coordinates[0]]);
          setIdSearchError(null);
          setSelectedDistrict("All");
          setTimeout(() => {
            const m = markerMapRef.current[intern.id];
            if (m) m.openPopup();
          }, 1500);
        }
      } else {
        setIdSearchError("Intern not found for that ID.");
        setHighlightedIntern(null);
        setFlyTo(null);
      }
    } catch (err) {
      setIdSearchError(
        err.response?.status === 404
          ? "Intern not found for that ID."
          : "Failed to search intern location.",
      );
      setHighlightedIntern(null);
      setFlyTo(null);
    } finally {
      setIdSearchLoading(false);
    }
  };

  const clearIdSearch = () => {
    setIdSearch("");
    setHighlightedIntern(null);
    setFlyTo(null);
    setIdSearchError(null);
  };

  const handleListRowClick = (intern) => {
    setFlyTo([intern.coordinates[1], intern.coordinates[0]]);
    setTimeout(() => {
      const m = markerMapRef.current[intern.id];
      if (m) m.openPopup();
    }, 1500);
  };

  const countForDistrict = (d) =>
    districtCounts.find((c) => c._id === d)?.count ?? 0;

  const filteredListInterns = interns.filter((i) => {
    if (!listSearch.trim()) return true;
    const q = listSearch.toLowerCase();
    return (
      i.name?.toLowerCase().includes(q) ||
      i.id?.toLowerCase().includes(q) ||
      i.address?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800">
      <main className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-6"
        >
          <div>
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="mb-4 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-sm transition-all duration-200 text-sm font-medium text-gray-600"
            >
              <FaArrowLeft className="inline mr-2" />
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

          <motion.div
            whileHover={{ scale: 1.03 }}
            className="flex items-center gap-4 bg-white px-6 py-5 rounded-2xl shadow-md border border-gray-100"
          >
            <div className="bg-blue-500 text-white p-4 rounded-xl shadow-lg">
              <FaUsers className="text-2xl" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {selectedDistrict === "All"
                  ? "Total Interns with Location"
                  : `Interns in ${selectedDistrict}`}
              </p>
              <p className="text-3xl font-bold text-blue-600">
                {interns.length}
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* ── FILTER & SEARCH BAR ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 mb-6"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                <FaFilter className="inline mr-1" /> Filter by District
              </label>
              <div className="relative">
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all cursor-pointer pr-10"
                >
                  {SRI_LANKA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d === "All"
                        ? "All Districts"
                        : `${d}${countForDistrict(d) > 0 ? ` (${countForDistrict(d)})` : ""}`}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center">
              <div className="w-px h-12 bg-gray-200" />
            </div>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                <FaSearch className="inline mr-1" /> Find Intern by ID
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={idSearch}
                    onChange={(e) => setIdSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleIdSearch()}
                    placeholder="intern ID"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all pr-8"
                  />
                  {idSearch && (
                    <button
                      onClick={clearIdSearch}
                      className="absolute inset-y-0 right-2.5 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes className="text-xs" />
                    </button>
                  )}
                </div>
                <button
                  onClick={handleIdSearch}
                  disabled={idSearchLoading}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-xl shadow-sm transition-all duration-200 flex items-center gap-2 whitespace-nowrap"
                >
                  {idSearchLoading ? (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FaSearch />
                  )}
                  Search
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {(idSearchError || highlightedIntern) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden"
              >
                {idSearchError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">
                    <FaExclamationTriangle className="shrink-0" />
                    {idSearchError}
                  </div>
                )}
                {highlightedIntern && !idSearchError && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-sm">
                    <FaMapMarkerAlt className="shrink-0 text-amber-500" />
                    <span>
                      Showing location for{" "}
                      <strong>{highlightedIntern.name}</strong>
                      {highlightedIntern.district
                        ? ` — ${highlightedIntern.district}`
                        : ""}
                    </span>
                    <button
                      onClick={clearIdSearch}
                      className="ml-auto text-amber-600 hover:text-amber-800"
                    >
                      <FaTimes />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── ERROR ── */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl mb-6"
          >
            {error}
          </motion.div>
        )}

        {/* ── MAP ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">
                Loading intern locations...
              </p>
            </div>
          ) : (
            <MapContainer
              center={[7.8731, 80.7718]}
              zoom={8}
              style={{ height: "650px", width: "100%" }}
              scrollWheelZoom
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {flyTo && <FlyTo position={flyTo} />}
              <SpiderfyLayer
                interns={interns}
                highlightedId={highlightedIntern?.id}
                onReady={(markerMap) => {
                  markerMapRef.current = markerMap;
                }}
              />
            </MapContainer>
          )}
        </motion.div>

        {/* ── DISTRICT INTERN LIST ── */}
        <AnimatePresence>
          {selectedDistrict !== "All" && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="mt-6 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <FaMapMarkerAlt className="text-blue-600 text-sm" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-base">
                      Interns in {selectedDistrict}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {filteredListInterns.length} of {interns.length} intern
                      {interns.length !== 1 ? "s" : ""} shown
                    </p>
                  </div>
                </div>
                <div className="relative sm:w-64">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none" />
                  <input
                    type="text"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder="Search name, ID or address…"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-8 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
                  />
                  {listSearch && (
                    <button
                      onClick={() => setListSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes className="text-xs" />
                    </button>
                  )}
                </div>
              </div>

              {filteredListInterns.length === 0 ? (
                <div className="text-center py-14 text-gray-400 text-sm">
                  No interns match your search.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-left">
                        <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">
                          #
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <FaIdCard className="text-gray-300" />
                            Trainee ID
                          </span>
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <FaHome className="text-gray-300" />
                            Address
                          </span>
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredListInterns.map((intern, idx) => (
                        <motion.tr
                          key={intern.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(idx * 0.025, 0.4) }}
                          className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors duration-150"
                        >
                          <td className="px-6 py-3.5 text-gray-300 text-xs font-medium">
                            {idx + 1}
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 tracking-wide">
                              {intern.id}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-semibold text-gray-800">
                            {intern.name}
                          </td>
                          <td className="px-6 py-3.5 text-gray-500 text-xs max-w-xs">
                            {intern.address ? (
                              <span className="line-clamp-2">
                                {intern.address}
                              </span>
                            ) : (
                              <span className="italic text-gray-300">
                                No address on record
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <button
                              onClick={() => handleListRowClick(intern)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg shadow-sm transition-all duration-150"
                            >
                              <FaMapMarkerAlt className="text-xs" />
                              View on Map
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AdminInternLocations;
