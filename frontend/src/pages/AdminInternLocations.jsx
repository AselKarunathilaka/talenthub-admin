import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import {
  FaArrowLeft,
  FaUsers,
  FaSearch,
  FaFilter,
  FaTimes,
  FaExclamationTriangle,
  FaHome,
  FaIdCard,
  FaHistory,
  FaToggleOn,
  FaToggleOff,
  FaMapMarkerAlt,
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

// Highlighted active intern (orange)
const highlightIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Past intern marker (violet)
const pastInternIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
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

// ── OMS spiderfy layer ────────────────────────────────────────────────────────
function SpiderfyLayer({ interns, highlightedId, markerIcon, onReady }) {
  const map = useMap();
  const omsRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const scriptId = "oms-script";

    const init = () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
      if (omsRef.current) omsRef.current.clearMarkers();

      const OMS = window.OverlappingMarkerSpiderfier;
      if (!OMS) return;

      const oms = new OMS(map, {
        markersWontMove: true,
        markersWontHide: true,
        basicFormatEvents: true,
        nearbyDistance: 20,
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
        const icon = isHighlighted
          ? highlightIcon
          : markerIcon || new L.Icon.Default();

        const marker = L.marker(
          [intern.coordinates[1], intern.coordinates[0]],
          { icon, zIndexOffset: isHighlighted ? 1000 : 0 },
        );

        const badgeColor = intern.isPast ? "#7c3aed" : "#1e40af";
        const badgeLabel = intern.isPast ? "Past Intern" : "Active";

        const popupContent = `
          <div style="min-width:185px;font-size:13px;line-height:1.6">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <p style="font-weight:700;color:#1e293b;margin:0">${intern.name}</p>
              <span style="font-size:10px;background:${badgeColor};color:#fff;padding:1px 6px;border-radius:10px;white-space:nowrap">${badgeLabel}</span>
            </div>
            <p style="color:#475569;margin:0 0 2px">
              <span style="font-weight:600">ID:</span> ${intern.id}
            </p>
            ${intern.district ? `<p style="color:#475569;margin:0 0 2px"><span style="font-weight:600">District:</span> ${intern.district}</p>` : ""}
            ${intern.institute ? `<p style="color:#475569;margin:0 0 2px"><span style="font-weight:600">Institute:</span> ${intern.institute}</p>` : ""}
            <p style="color:#94a3b8;font-size:11px;margin:4px 0 0;line-height:1.4">
              ${intern.address || "<em>No address</em>"}
            </p>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 260 });
        oms.addMarker(marker);
        layer.addLayer(marker);
        newMarkerMap[intern.id] = marker;
      });

      map.addLayer(layer);
      layerRef.current = layer;
      omsRef.current = oms;

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

  // Active interns
  const [interns, setInterns] = useState([]);
  const [districtCounts, setDistrictCounts] = useState([]);       // active counts
  const [pastDistrictCounts, setPastDistrictCounts] = useState([]); // past counts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Past interns toggle
  const [showPastInterns, setShowPastInterns] = useState(false);
  const [pastInterns, setPastInterns] = useState([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [pastError, setPastError] = useState(null);
  const [pastFetched, setPastFetched] = useState(false);

  // Shared UI state
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

  // ── Fetch active intern locations ─────────────────────────────────────────
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

  // ── Fetch active district counts ──────────────────────────────────────────
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

  // ── Fetch past district counts ────────────────────────────────────────────
  const fetchPastDistrictCounts = useCallback(
    async (token) => {
      try {
        const res = await axios.get(
          `${API_BASE}/admin/past-intern-district-counts`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.data.success) setPastDistrictCounts(res.data.data);
      } catch {}
    },
    [API_BASE],
  );

  // ── Fetch past intern locations ───────────────────────────────────────────
  const fetchPastInternLocations = useCallback(
    async (token, district = "All") => {
      try {
        setPastLoading(true);
        setPastError(null);
        const params = district !== "All" ? { district } : {};
        const res = await axios.get(
          `${API_BASE}/admin/past-intern-locations`,
          { headers: { Authorization: `Bearer ${token}` }, params },
        );
        if (res.data.success) {
          const valid = res.data.data.filter(
            (i) =>
              i.coordinates &&
              Array.isArray(i.coordinates) &&
              i.coordinates.length === 2 &&
              i.coordinates[0] != null &&
              i.coordinates[1] != null,
          );
          setPastInterns(valid);
          setPastFetched(true);
        } else {
          setPastError("Failed to load past intern locations");
        }
      } catch {
        setPastError("Failed to fetch past intern locations");
      } finally {
        setPastLoading(false);
      }
    },
    [API_BASE],
  );

  // ── Initial load + 1-hour auto-refresh ───────────────────────────────────
  useEffect(() => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (!adminInfo.token) {
      navigate("/admin-login");
      return;
    }
    fetchInternLocations(adminInfo.token, "All");
    fetchDistrictCounts(adminInfo.token);
    fetchPastDistrictCounts(adminInfo.token);

    // Refresh every 1 hour (was 5 minutes — no need to hammer the server)
    const iv = setInterval(
      () => {
        fetchInternLocations(adminInfo.token, selectedDistrict);
        fetchDistrictCounts(adminInfo.token);
        fetchPastDistrictCounts(adminInfo.token);
      },
      60 * 60 * 1000,
    );
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-fetch when district filter changes ─────────────────────────────────
  useEffect(() => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (!adminInfo.token) return;
    setHighlightedIntern(null);
    setFlyTo(null);
    setListSearch("");
    fetchInternLocations(adminInfo.token, selectedDistrict);
    if (showPastInterns && pastFetched) {
      fetchPastInternLocations(adminInfo.token, selectedDistrict);
    }
  }, [selectedDistrict, fetchInternLocations, fetchPastInternLocations]);

  // ── Toggle past interns ───────────────────────────────────────────────────
  const handleTogglePastInterns = () => {
    const next = !showPastInterns;
    setShowPastInterns(next);
    if (next && !pastFetched) {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      if (adminInfo.token) {
        fetchPastInternLocations(adminInfo.token, selectedDistrict);
      }
    }
  };

  // ── Combined district count (active + past when toggle is on) ─────────────
  // This is what shows in the dropdown next to each district name
  const countForDistrict = (d) => {
    const activeCount =
      districtCounts.find((c) => c._id === d)?.count ?? 0;
    const pastCount = showPastInterns
      ? (pastDistrictCounts.find((c) => c._id === d)?.count ?? 0)
      : 0;
    return activeCount + pastCount;
  };

  // ── ID search ─────────────────────────────────────────────────────────────
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
    <AdminNavigation>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 text-gray-800 relative">
        <main className="p-6 lg:p-8 max-w-7xl mx-auto">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-6 gap-4 xl:gap-6"
        >
          {/* TITLE */}
          <div className="shrink-0">
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-3 tracking-tight whitespace-nowrap"
            >
              <div className="p-2 bg-[#00b4eb]/10 rounded-xl shrink-0">
                <MapPin className="text-[#0056a2] h-6 w-6 sm:h-8 sm:w-8" />
              </div>
              Intern Locations
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05, duration: 0.2 }}
              className="text-gray-500 mt-2 text-sm font-medium whitespace-nowrap"
            >
              Live overview of all registered intern locations
            </motion.p>
          </div>

          {/* RIGHT SIDE ITEMS - 4 CARDS */}
<<<<<<< HEAD
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2 xl:gap-3 w-full min-w-0">
=======
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2 xl:gap-3 w-full min-w-0">
>>>>>>> talenthub/main
            
            {/* Active intern count card (a) */}
            <motion.div
              whileHover={{ scale: 1.02 }}
<<<<<<< HEAD
              className="order-1 lg:order-none flex items-center gap-2 sm:gap-3 bg-white px-3 sm:px-3 py-3 sm:py-2 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 min-h-[72px] sm:min-h-[68px]"
            >
              <div className="bg-blue-50 text-blue-600 p-2 sm:p-2 rounded-lg sm:rounded-xl shrink-0">
                <FaUsers className="text-base sm:text-base" />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-[10px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
=======
              className="order-1 lg:order-none flex items-center gap-2 sm:gap-3 bg-white px-2 sm:px-3 py-2 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 min-h-[60px] sm:min-h-[68px]"
            >
              <div className="bg-blue-50 text-blue-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0">
                <FaUsers className="text-sm sm:text-base" />
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
>>>>>>> talenthub/main
                  {selectedDistrict === "All"
                    ? "Active Interns"
                    : `Active in ${selectedDistrict}`}
                </p>
<<<<<<< HEAD
                <p className="text-lg sm:text-lg font-bold text-gray-800 leading-none truncate">
=======
                <p className="text-base sm:text-lg font-bold text-gray-800 leading-none truncate">
>>>>>>> talenthub/main
                  {interns.length}
                </p>
              </div>
            </motion.div>

            {/* Past interns toggle card (b) */}
            <motion.div
              whileHover={{ scale: 1.02 }}
<<<<<<< HEAD
              className="order-3 lg:order-none flex items-center justify-between bg-white px-3 sm:px-3 py-3 sm:py-2 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 min-h-[72px] sm:min-h-[68px]"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="bg-violet-50 text-violet-600 p-2 sm:p-2 rounded-lg sm:rounded-xl shrink-0">
                  <FaHistory className="text-base sm:text-base" />
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-[10px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                    Past Interns
                  </p>
                  <p className="text-lg sm:text-lg font-bold text-gray-800 leading-none truncate">
=======
              className="order-3 lg:order-none flex items-center justify-between bg-white px-2 sm:px-3 py-2 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 min-h-[60px] sm:min-h-[68px]"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="bg-violet-50 text-violet-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0">
                  <FaHistory className="text-sm sm:text-base" />
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5 truncate">
                    Past Interns
                  </p>
                  <p className="text-base sm:text-lg font-bold text-gray-800 leading-none truncate">
>>>>>>> talenthub/main
                    {pastFetched ? pastInterns.length : "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleTogglePastInterns}
                disabled={pastLoading}
<<<<<<< HEAD
                className="flex items-center justify-center transition-all duration-200 ml-1 shrink-0 p-1"
                title={showPastInterns ? "Hide past interns" : "Show past interns"}
              >
                {pastLoading ? (
                  <span className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                ) : showPastInterns ? (
                  <FaToggleOn className="text-[26px] sm:text-[24px] text-violet-600" />
                ) : (
                  <FaToggleOff className="text-[26px] sm:text-[24px] text-gray-300 hover:text-gray-400" />
=======
                className="flex items-center justify-center transition-all duration-200 ml-1 shrink-0"
                title={showPastInterns ? "Hide past interns" : "Show past interns"}
              >
                {pastLoading ? (
                  <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                ) : showPastInterns ? (
                  <FaToggleOn className="text-[20px] sm:text-[24px] text-violet-600" />
                ) : (
                  <FaToggleOff className="text-[20px] sm:text-[24px] text-gray-300 hover:text-gray-400" />
>>>>>>> talenthub/main
                )}
              </button>
            </motion.div>

            {/* Filter by district (c) */}
            <motion.div
              whileHover={{ scale: 1.02 }}
<<<<<<< HEAD
              className="order-2 lg:order-none flex flex-col justify-center bg-white px-3 sm:px-3 py-3 sm:py-2 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 min-h-[72px] sm:min-h-[68px]"
            >
              <label className="block text-[10px] sm:text-[10px] font-semibold text-gray-500 mb-1.5 sm:mb-1 uppercase tracking-wider flex items-center gap-1.5 sm:gap-1">
                <FaFilter className="text-emerald-500 text-[10px] sm:text-[9px] shrink-0" /> <span className="truncate">Filter by District</span>
=======
              className="order-2 lg:order-none flex flex-col justify-center bg-white px-2 sm:px-3 py-2 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 min-h-[60px] sm:min-h-[68px]"
            >
              <label className="block text-[9px] sm:text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                <FaFilter className="text-emerald-500 text-[9px] shrink-0" /> <span className="truncate">Filter by District</span>
>>>>>>> talenthub/main
              </label>
              <div className="relative">
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
<<<<<<< HEAD
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-2 py-2 sm:py-1 text-xs sm:text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all cursor-pointer pr-7 sm:pr-6"
=======
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2 py-1 text-[10px] sm:text-xs text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all cursor-pointer pr-6"
>>>>>>> talenthub/main
                >
                  {SRI_LANKA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d === "All"
                        ? "All Districts"
                        : `${d}${countForDistrict(d) > 0 ? ` (${countForDistrict(d)})` : ""}`}
                    </option>
                  ))}
                </select>
<<<<<<< HEAD
                <div className="pointer-events-none absolute inset-y-0 right-2 sm:right-1.5 flex items-center text-gray-400">
                  <svg className="w-4 h-4 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
=======
                <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-gray-400">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
>>>>>>> talenthub/main
                </div>
              </div>
            </motion.div>

            {/* Find interns by id (d) */}
            <motion.div
              whileHover={{ scale: 1.02 }}
<<<<<<< HEAD
              className="order-4 lg:order-none flex flex-col justify-center bg-white px-3 sm:px-3 py-3 sm:py-2 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 min-h-[72px] sm:min-h-[68px]"
            >
              <label className="block text-[10px] sm:text-[10px] font-semibold text-gray-500 mb-1.5 sm:mb-1 uppercase tracking-wider flex items-center gap-1.5 sm:gap-1">
                <FaIdCard className="text-blue-500 text-[10px] sm:text-[9px] shrink-0" /> <span className="truncate">Find Intern by ID</span>
              </label>
              <div className="flex gap-1.5 sm:gap-1">
=======
              className="order-4 lg:order-none flex flex-col justify-center bg-white px-2 sm:px-3 py-2 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 min-h-[60px] sm:min-h-[68px]"
            >
              <label className="block text-[9px] sm:text-[10px] font-semibold text-gray-500 mb-1 uppercase tracking-wider flex items-center gap-1">
                <FaIdCard className="text-blue-500 text-[9px] shrink-0" /> <span className="truncate">Find Intern by ID</span>
              </label>
              <div className="flex gap-1">
>>>>>>> talenthub/main
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={idSearch}
                    onChange={(e) => setIdSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleIdSearch()}
                    placeholder="Search ID"
<<<<<<< HEAD
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2.5 sm:px-2 py-2 sm:py-1 text-xs sm:text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all pr-6 sm:pr-5"
=======
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl px-2 py-1 text-[10px] sm:text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all pr-5"
>>>>>>> talenthub/main
                  />
                  {idSearch && (
                    <button
                      onClick={clearIdSearch}
<<<<<<< HEAD
                      className="absolute inset-y-0 right-1.5 sm:right-1.5 flex items-center p-1 text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes className="text-[11px] sm:text-[9px]" />
=======
                      className="absolute inset-y-0 right-1.5 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes className="text-[9px]" />
>>>>>>> talenthub/main
                    </button>
                  )}
                </div>
                <button
                  onClick={handleIdSearch}
                  disabled={idSearchLoading}
<<<<<<< HEAD
                  className="px-3 sm:px-2 py-2 sm:py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg sm:rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center shrink-0"
                  title="Search"
                >
                  {idSearchLoading ? (
                    <span className="w-4 h-4 sm:w-3 sm:h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FaSearch className="text-[12px] sm:text-[10px]" />
=======
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg sm:rounded-xl shadow-sm transition-all duration-200 flex items-center justify-center shrink-0"
                  title="Search"
                >
                  {idSearchLoading ? (
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FaSearch className="text-[10px]" />
>>>>>>> talenthub/main
                  )}
                </button>
              </div>
            </motion.div>

          </div>
        </motion.div>

        {/* ── SEARCH MESSAGES / ALERTS ── */}
        <AnimatePresence>
          {(idSearchError || highlightedIntern) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              {idSearchError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm shadow-sm">
                  <FaExclamationTriangle className="shrink-0" />
                  {idSearchError}
                </div>
              )}
              {highlightedIntern && !idSearchError && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm shadow-sm">
                  <MapPin className="shrink-0 text-amber-500 w-4 h-4" />
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

        {/* ── PAST INTERN LOADING / ERROR ── */}
        <AnimatePresence>
          {pastLoading && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-violet-50 border border-violet-200 text-violet-700 px-5 py-3 rounded-xl mb-4 text-sm flex items-center gap-3 shadow-sm"
            >
              <span className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin shrink-0" />
              Loading past intern locations…
            </motion.div>
          )}
          {pastError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl mb-4 text-sm flex items-center gap-2 shadow-sm"
            >
              <FaExclamationTriangle className="shrink-0" />
              {pastError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LEGEND (shown when past interns are visible) ── */}
        {showPastInterns && pastFetched && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap items-center justify-center gap-6 bg-white px-5 py-3 rounded-xl shadow-sm border border-gray-100 mb-4 text-sm"
          >
            <span className="flex items-center gap-2">
              <img
                src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png"
                alt="active"
                className="h-4"
              />
              <span className="text-gray-600">Active intern</span>
            </span>
            <span className="flex items-center gap-2">
              <img
                src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png"
                alt="past"
                className="h-4"
              />
              <span className="text-violet-700 font-medium">Past intern</span>
            </span>
          </motion.div>
        )}

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
<<<<<<< HEAD
          className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative"
        >
          {loading && (
            <div className="absolute inset-0 z-[1000] bg-white/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin shadow-md" />
              <p className="text-blue-900 font-semibold bg-white/90 px-5 py-2 rounded-full shadow-sm text-sm border border-blue-100">Loading intern locations...</p>
            </div>
          )}
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

            {/* Active interns layer */}
            <SpiderfyLayer
              interns={interns}
              highlightedId={highlightedIntern?.id}
              markerIcon={null}
              onReady={(markerMap) => {
                markerMapRef.current = { ...markerMapRef.current, ...markerMap };
              }}
            />

            {/* Past interns layer — only mounted when toggle is on */}
            {showPastInterns && pastInterns.length > 0 && (
              <SpiderfyLayer
                interns={pastInterns}
                highlightedId={null}
                markerIcon={pastInternIcon}
=======
          className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-gray-500 text-sm">Loading intern locations...</p>
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

              {/* Active interns layer */}
              <SpiderfyLayer
                interns={interns}
                highlightedId={highlightedIntern?.id}
                markerIcon={null}
>>>>>>> talenthub/main
                onReady={(markerMap) => {
                  markerMapRef.current = { ...markerMapRef.current, ...markerMap };
                }}
              />
<<<<<<< HEAD
            )}
          </MapContainer>
=======

              {/* Past interns layer — only mounted when toggle is on */}
              {showPastInterns && pastInterns.length > 0 && (
                <SpiderfyLayer
                  interns={pastInterns}
                  highlightedId={null}
                  markerIcon={pastInternIcon}
                  onReady={(markerMap) => {
                    markerMapRef.current = { ...markerMapRef.current, ...markerMap };
                  }}
                />
              )}
            </MapContainer>
          )}
>>>>>>> talenthub/main
        </motion.div>

        {/* ── DISTRICT INTERN LIST (active only) ── */}
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
                      Active Interns in {selectedDistrict}
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
                              <span className="line-clamp-2">{intern.address}</span>
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
  </AdminNavigation>
  );
};

export default AdminInternLocations;
