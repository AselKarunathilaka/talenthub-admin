import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  FaEye,
  FaEyeSlash,
  FaSpinner,
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

// ── Sri Lanka Bounding Coordinates ───────────────────────────────────────────
const SRI_LANKA_BOUNDS = [
  [5.90, 79.65], // Southwest (Dondra / Galle)
  [9.85, 81.90], // Northeast (Point Pedro / Jaffna)
];

const OMS_CSS = `
  .oms-shadow { stroke: #999; stroke-width: 1; }
  .leaflet-marker-icon { transition: opacity 0.2s; }
  .leaflet-container { 
    z-index: 1 !important; 
    isolation: isolate; 
    contain: layout paint;
    touch-action: pan-x pan-y;
  }
  .leaflet-pane { z-index: 2 !important; }
  .leaflet-top, .leaflet-bottom { z-index: 10 !important; }
  .leaflet-control { z-index: 10 !important; }
`;

// ── FlyTo helper ──────────────────────────────────────────────────────────────
const FlyTo = React.memo(function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 14, { duration: 1.2 });
  }, [position, map]);
  return null;
});

// ── Sri Lanka Map Aligner ───────────────────────────────────────────────────
const SriLankaMapAligner = React.memo(function SriLankaMapAligner({ flyTo }) {
  const map = useMap();
  const hasAlignedRef = useRef(false);

  useEffect(() => {
    if (hasAlignedRef.current) return;

    const alignSriLanka = () => {
      map.invalidateSize();
      if (!flyTo) {
        const width = window.innerWidth;
        let padding = [24, 24];
        let maxZoom = 9;

        if (width < 640) {
          padding = [10, 6];
          maxZoom = 8.5;
        } else if (width <= 1024) {
          padding = [16, 12];
          maxZoom = 8.5;
        }

        map.fitBounds(SRI_LANKA_BOUNDS, {
          padding,
          animate: false,
          maxZoom,
        });
      }
    };

    alignSriLanka();
    const t1 = setTimeout(alignSriLanka, 80);
    const t2 = setTimeout(alignSriLanka, 300);
    hasAlignedRef.current = true;

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map, flyTo]);

  // Window resize debounced invalidateSize only (never re-fitting bounds or fighting scroll)
  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.invalidateSize();
      }, 200);
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  return null;
});

// ── OMS spiderfy layer ────────────────────────────────────────────────────────
const SpiderfyLayer = React.memo(function SpiderfyLayer({ interns, highlightedId, markerIcon, onReady }) {
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
});

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
  const [tableFilter, setTableFilter] = useState("all"); // "all", "active", "past"

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
          const valid = res.data.data
            .filter(
              (i) =>
                i.coordinates &&
                Array.isArray(i.coordinates) &&
                i.coordinates.length === 2 &&
                i.coordinates[0] != null &&
                i.coordinates[1] != null,
            )
            .map((i) => ({ ...i, isPast: false }));
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
          const valid = res.data.data
            .filter(
              (i) =>
                i.coordinates &&
                Array.isArray(i.coordinates) &&
                i.coordinates.length === 2 &&
                i.coordinates[0] != null &&
                i.coordinates[1] != null,
            )
            .map((i) => ({ ...i, isPast: true }));
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

    // Refresh every 1 hour (was 5 minutes — no need to hammer the server)
    const iv = setInterval(
      () => {
        fetchInternLocations(adminInfo.token, selectedDistrict);
        fetchDistrictCounts(adminInfo.token);
        if (showPastInterns) {
          fetchPastInternLocations(adminInfo.token, selectedDistrict);
          fetchPastDistrictCounts(adminInfo.token);
        }
      },
      60 * 60 * 1000,
    );
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPastInterns, selectedDistrict]);

  // ── Re-fetch when district filter changes ─────────────────────────────────
  useEffect(() => {
    const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
    if (!adminInfo.token) return;
    setHighlightedIntern(null);
    setFlyTo(null);
    setListSearch("");
    fetchInternLocations(adminInfo.token, selectedDistrict);
    if (showPastInterns) {
      fetchPastInternLocations(adminInfo.token, selectedDistrict);
    }
  }, [selectedDistrict, fetchInternLocations, fetchPastInternLocations, showPastInterns]);

  // ── Security Popup State ──────────────────────────────────────────────────
  const [showSecurityPopup, setShowSecurityPopup] = useState(false);
  const [securityPassword, setSecurityPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const executeTogglePastInterns = useCallback(() => {
    setShowPastInterns((prev) => {
      const next = !prev;
      if (next && !pastFetched) {
        const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
        if (adminInfo.token) {
          fetchPastInternLocations(adminInfo.token, selectedDistrict);
          fetchPastDistrictCounts(adminInfo.token);
        }
      }
      return next;
    });
  }, [pastFetched, fetchPastInternLocations, fetchPastDistrictCounts, selectedDistrict]);

  const handlePasswordVerify = async () => {
    if (!securityPassword) {
      setPasswordError("Please enter the security password");
      return;
    }
    setSettingsSaving(true);
    setPasswordError("");
    try {
      const adminInfo = JSON.parse(localStorage.getItem("adminInfo") || "{}");
      const actionName = !showPastInterns ? "past intern locations visibility toggled on" : "past intern locations visibility toggled off";
      
      const res = await axios.post(
        `${API_BASE}/admin/attendance/verify-security`,
        { securityPin: securityPassword, action: actionName },
        { headers: { Authorization: `Bearer ${adminInfo.token}` } }
      );
      
      if (res.data.success || res.status === 200) {
        setShowSecurityPopup(false);
        setSecurityPassword("");
        setPasswordError("");
        executeTogglePastInterns();
      }
    } catch (err) {
      setPasswordError(err.response?.data?.message || "Invalid security password");
    } finally {
      setSettingsSaving(false);
    }
  };

  // ── Toggle past interns ───────────────────────────────────────────────────
  const handleTogglePastInterns = useCallback(() => {
    setSecurityPassword("");
    setPasswordError("");
    setShowPasswordText(false);
    setShowSecurityPopup(true);
  }, []);

  // ── Combined district count (active + past when toggle is on) ─────────────
  // This is what shows in the dropdown next to each district name
  const countForDistrict = useCallback(
    (d) => {
      const activeCount =
        districtCounts.find((c) => c._id === d)?.count ?? 0;
      const pastCount = showPastInterns
        ? (pastDistrictCounts.find((c) => c._id === d)?.count ?? 0)
        : 0;
      return activeCount + pastCount;
    },
    [districtCounts, showPastInterns, pastDistrictCounts],
  );

  // ── ID search ─────────────────────────────────────────────────────────────
  const handleIdSearch = useCallback(async () => {
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
          }, 800);
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
  }, [idSearch, API_BASE]);

  const clearIdSearch = useCallback(() => {
    setIdSearch("");
    setHighlightedIntern(null);
    setFlyTo(null);
    setIdSearchError(null);
  }, []);

  const handleListRowClick = useCallback((intern) => {
    if (intern.isPast && !showPastInterns) {
      setShowPastInterns(true);
    }
    setFlyTo([intern.coordinates[1], intern.coordinates[0]]);
    setTimeout(() => {
      const m = markerMapRef.current[intern.id];
      if (m) m.openPopup();
    }, 800);
  }, [showPastInterns]);

  const handleMarkerMapReady = useCallback((markerMap) => {
    Object.assign(markerMapRef.current, markerMap);
  }, []);

  const combinedInterns = useMemo(
    () => [...interns, ...pastInterns],
    [interns, pastInterns],
  );

  const filteredListInterns = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return combinedInterns
      .filter((i) => {
        if (tableFilter === "active") return !i.isPast;
        if (tableFilter === "past") return i.isPast;
        return true;
      })
      .filter((i) => {
        if (!q) return true;
        return (
          i.name?.toLowerCase().includes(q) ||
          i.id?.toLowerCase().includes(q) ||
          i.address?.toLowerCase().includes(q)
        );
      });
  }, [combinedInterns, tableFilter, listSearch]);

  return (
    <AdminNavigation>
      <div className="min-h-full relative font-sans text-slate-800 flex flex-col select-none">
        <main className="relative flex-1 p-3 sm:p-6 sm:px-8 mx-auto max-w-[1400px] w-full flex flex-col gap-5 sm:gap-6 min-w-0">

        {/* ── TOP HEADER (Same as AdminDashboard) ── */}
        <div className="relative z-20 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 sm:gap-6 pt-2">
          {/* Left: Title and Icon */}
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="p-2.5 sm:p-3 md:p-3.5 bg-gradient-to-br from-[#000066] to-[#006600] shadow-md rounded-lg sm:rounded-xl md:rounded-2xl border border-[#006600]/20 flex-shrink-0"
            >
              <MapPin className="text-white h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
            </motion.div>
            <div className="flex flex-col justify-center">
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight"
              >
                Intern Locations
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="text-slate-500 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base font-medium max-w-xl"
              >
                Live overview of all registered intern locations
              </motion.p>
            </div>
          </div>

          {/* Right: Live GPS Pill */}
          <div className="flex items-center gap-3 w-full xl:w-auto justify-start xl:justify-end">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="flex items-center gap-2 bg-white border border-slate-200/80 shadow-sm px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-[8px]"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-700">Live GPS Locations</span>
            </motion.div>
          </div>
        </div>

        {/* ── 4 TOP CARDS (Under Title) ── */}
        <motion.section 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5 z-10 w-full relative"
        >
          {/* Card 1: Active Interns */}
          <div className="group bg-white p-3.5 sm:p-4 md:p-5 rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 hover:border-[#000066]/30 hover:shadow-lg transition-all duration-300 flex flex-col justify-between shadow-sm cursor-default">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl md:rounded-2xl bg-[#000066]/5 transition-transform group-hover:scale-110 duration-300 flex items-center justify-center">
                <FaUsers className="w-4 h-4 sm:w-5 sm:h-5 text-[#000066]" />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#0056a2] border border-blue-100">
                Active
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#000066] tracking-tight">
                {loading ? "..." : interns.length}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider truncate">
                {selectedDistrict === "All"
                  ? "Active Interns"
                  : `Active in ${selectedDistrict}`}
              </div>
            </div>
          </div>

          {/* Card 2: Past Interns */}
          <div className="group bg-white p-3.5 sm:p-4 md:p-5 rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 hover:border-violet-300 hover:shadow-lg transition-all duration-300 flex flex-col justify-between shadow-sm cursor-default">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl md:rounded-2xl bg-violet-50 transition-transform group-hover:scale-110 duration-300 flex items-center justify-center">
                <FaHistory className="w-4 h-4 sm:w-5 sm:h-5 text-violet-600" />
              </div>
              <button
                type="button"
                onClick={handleTogglePastInterns}
                disabled={pastLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 hover:bg-violet-100 border border-violet-200/60 transition-colors cursor-pointer"
                title={showPastInterns ? "Hide past interns from map" : "Show past interns on map"}
              >
                <span className="text-xs font-bold text-violet-700">
                  {showPastInterns ? "Visible" : "Hidden"}
                </span>
                {pastLoading ? (
                  <span className="w-4 h-4 border-2 border-violet-400 border-t-violet-700 rounded-full animate-spin" />
                ) : showPastInterns ? (
                  <FaToggleOn className="text-2xl text-violet-600" />
                ) : (
                  <FaToggleOff className="text-2xl text-slate-400" />
                )}
              </button>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-violet-700 tracking-tight">
                {pastFetched ? pastInterns.length : "—"}
              </div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider truncate">
                Past Interns (Alumni)
              </div>
            </div>
          </div>

          {/* Card 3: Filter by District */}
          <div className="group bg-white p-3.5 sm:p-4 md:p-5 rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 hover:border-[#006600]/30 hover:shadow-lg transition-all duration-300 flex flex-col justify-between shadow-sm cursor-default">
            <div className="flex justify-between items-start mb-1.5 sm:mb-2">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl md:rounded-2xl bg-[#006600]/5 transition-transform group-hover:scale-110 duration-300 flex items-center justify-center">
                <FaFilter className="w-4 h-4 sm:w-5 sm:h-5 text-[#006600]" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {selectedDistrict}
              </span>
            </div>
            <div>
              <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Filter by District
              </label>
              <div className="relative">
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full appearance-none bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#006600]/30 focus:border-[#006600] transition-all cursor-pointer pr-8"
                >
                  {SRI_LANKA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d === "All"
                        ? "All Districts"
                        : `${d}${countForDistrict(d) > 0 ? ` (${countForDistrict(d)})` : ""}`}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-slate-400">
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Find Intern by ID */}
          <div className="group bg-white p-3.5 sm:p-4 md:p-5 rounded-xl sm:rounded-[14px] md:rounded-2xl border border-slate-200/80 hover:border-sky-300 hover:shadow-lg transition-all duration-300 flex flex-col justify-between shadow-sm cursor-default">
            <div className="flex justify-between items-start mb-1.5 sm:mb-2">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl md:rounded-2xl bg-sky-50 transition-transform group-hover:scale-110 duration-300 flex items-center justify-center">
                <FaIdCard className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Search
              </span>
            </div>
            <div>
              <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Find Intern by ID
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={idSearch}
                    onChange={(e) => setIdSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleIdSearch()}
                    placeholder="Enter ID..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-800 font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all pr-7 select-text"
                  />
                  {idSearch && (
                    <button
                      type="button"
                      onClick={clearIdSearch}
                      className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <FaTimes className="text-xs" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleIdSearch}
                  disabled={idSearchLoading}
                  className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-[#0056a2] hover:bg-[#004482] disabled:opacity-50 text-white rounded-lg sm:rounded-xl shadow-sm transition-all flex items-center justify-center shrink-0 cursor-pointer"
                  title="Search Intern"
                >
                  {idSearchLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <FaSearch className="text-xs sm:text-sm" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.section>

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
          className="bg-white rounded-xl sm:rounded-3xl shadow-md border border-slate-200/80 overflow-hidden relative z-10 isolate"
        >
          {loading && (
            <div className="absolute inset-0 z-[15] bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-[#0056a2] rounded-full animate-spin shadow-md" />
              <p className="text-[#000066] font-semibold bg-white/95 px-5 py-2 rounded-full shadow-sm text-sm border border-blue-100">Loading intern locations...</p>
            </div>
          )}
          <MapContainer
            bounds={SRI_LANKA_BOUNDS}
            boundsOptions={{ padding: [12, 12] }}
            className="h-[460px] sm:h-[620px] lg:h-[750px] xl:h-[840px] w-full"
            style={{ width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <SriLankaMapAligner flyTo={flyTo} />
            {flyTo && <FlyTo position={flyTo} />}

            {/* Active interns layer */}
            <SpiderfyLayer
              interns={interns}
              highlightedId={highlightedIntern?.id}
              markerIcon={null}
              onReady={handleMarkerMapReady}
            />

            {/* Past interns layer — only mounted when toggle is on */}
            {showPastInterns && pastInterns.length > 0 && (
              <SpiderfyLayer
                interns={pastInterns}
                highlightedId={null}
                markerIcon={pastInternIcon}
                onReady={handleMarkerMapReady}
              />
            )}
          </MapContainer>
        </motion.div>

        {/* ── DISTRICT INTERN LIST (active + past) ── */}
        <AnimatePresence>
          {selectedDistrict !== "All" && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
              className="mt-6 bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="bg-[#000066]/5 p-2 sm:p-2.5 rounded-xl shrink-0">
                    <FaMapMarkerAlt className="text-[#000066] text-sm" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                      Interns in {selectedDistrict}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                      {filteredListInterns.length} shown ({interns.length} active{pastInterns.length > 0 ? `, ${pastInterns.length} past` : ""})
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center lg:items-stretch xl:items-center gap-2.5 w-full sm:w-auto lg:w-fit lg:self-end xl:w-auto">
                  {/* Filter tabs */}
                  <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs w-full sm:w-auto lg:w-full">
                    <button
                      type="button"
                      onClick={() => setTableFilter("all")}
                      className={`flex-1 sm:flex-initial text-center px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        tableFilter === "all"
                          ? "bg-slate-800 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All ({combinedInterns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilter("active")}
                      className={`flex-1 sm:flex-initial text-center px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        tableFilter === "active"
                          ? "bg-blue-700 text-white shadow-xs"
                          : "text-blue-700 hover:text-blue-900"
                      }`}
                    >
                      Active ({interns.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableFilter("past")}
                      className={`flex-1 sm:flex-initial text-center px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        tableFilter === "past"
                          ? "bg-violet-700 text-white shadow-xs"
                          : "text-violet-700 hover:text-violet-900"
                      }`}
                    >
                      Past ({pastInterns.length})
                    </button>
                  </div>

                  {/* Search input */}
                  <div className="relative w-full sm:w-64 lg:w-full xl:w-100">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
                    <input
                      type="text"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      placeholder="Search name, ID or address…"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#000066]/20 focus:border-[#000066] transition-all select-text"
                    />
                    {listSearch && (
                      <button
                        onClick={() => setListSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        <FaTimes className="text-xs" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {filteredListInterns.length === 0 ? (
                <div className="text-center py-14 text-gray-400 text-sm">
                  No interns match your search.
                </div>
              ) : (
                <>
                  {/* Desktop Table (Hidden on mobile, 768px and 1024px screens) */}
                  <div className="hidden xl:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-left">
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-12 text-center">
                            #
                          </th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">
                            Trainee ID
                          </th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center w-36 sm:w-40">
                            Status
                          </th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            Address
                          </th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-44 text-center">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredListInterns.map((intern, idx) => (
                          <tr
                            key={intern.id}
                            className="border-b border-gray-50 hover:bg-blue-50/50 transition-colors duration-150"
                          >
                            <td className="px-4 sm:px-6 py-3.5 text-gray-300 text-xs font-medium text-center">
                              {idx + 1}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-center">
                              <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide ${
                                intern.isPast
                                  ? "bg-violet-100 text-violet-700 border border-violet-200"
                                  : "bg-blue-100 text-blue-700 border border-blue-200"
                              }`}>
                                {intern.id}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-center">
                              {intern.isPast ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                  Past Intern
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 font-semibold text-gray-800">
                              {intern.name}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-gray-500 text-xs max-w-xs">
                              {intern.address ? (
                                <span className="line-clamp-2">{intern.address}</span>
                              ) : (
                                <span className="italic text-gray-300">
                                  No address on record
                                </span>
                              )}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-center">
                              <button
                                onClick={() => handleListRowClick(intern)}
                                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-semibold rounded-lg shadow-sm transition-all duration-150 cursor-pointer active:scale-95 ${
                                  intern.isPast
                                    ? "bg-violet-600 hover:bg-violet-700"
                                    : "bg-blue-600 hover:bg-blue-700"
                                }`}
                              >
                                <FaMapMarkerAlt className="text-xs" />
                                View on Map
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Card View (For mobile, 768px and 1024px screens) */}
                  <div className="block xl:hidden p-3 sm:p-4 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
                      {filteredListInterns.map((intern, idx) => (
                        <div
                          key={intern.id}
                          className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-2.5 hover:border-slate-300 hover:shadow-sm transition-all"
                        >
                          <div className="flex flex-col gap-2">
                            {/* Top row: ID, Status & Index */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[11px] font-bold text-slate-400">
                                  #{idx + 1}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wide ${
                                  intern.isPast
                                    ? "bg-violet-100 text-violet-700 border border-violet-200"
                                    : "bg-blue-100 text-blue-700 border border-blue-200"
                                }`}>
                                  {intern.id}
                                </span>
                              </div>
                              {intern.isPast ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 shrink-0">
                                  Past Intern
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                  Active
                                </span>
                              )}
                            </div>

                            {/* Name & Address */}
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 text-sm truncate">
                                {intern.name}
                              </h4>
                              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                {intern.address || (
                                  <span className="italic text-gray-400">No address on record</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Action button */}
                          <button
                            type="button"
                            onClick={() => handleListRowClick(intern)}
                            className={`w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-white text-xs font-bold rounded-lg shadow-xs transition-all active:scale-[0.98] cursor-pointer ${
                              intern.isPast
                                ? "bg-violet-600 hover:bg-violet-700 active:bg-violet-800"
                                : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                            }`}
                          >
                            <FaMapMarkerAlt className="text-xs shrink-0" />
                            View on Map
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {/* Security Check Popup */}
      <AnimatePresence>
        {showSecurityPopup && (
          <>
            {/* Overlay covering full screen, under navbar/sidebar */}
            <div 
              className="fixed inset-0 z-[25] pointer-events-auto bg-slate-900/60 backdrop-blur-md transition-all duration-300" 
              onClick={() => setShowSecurityPopup(false)}
            />
            
            {/* Modal container - sticky to center in viewport while respecting content area horizontal bounds */}
            <div className="absolute inset-x-0 top-0 h-full z-50 pointer-events-none">
              <div className="sticky top-[30vh] w-full flex justify-center px-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm pointer-events-auto"
                >
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800">Security Check</h3>
                      <p className="text-xs text-slate-500 mt-1">Enter password to proceed</p>
                    </div>
                    <button 
                      onClick={() => setShowSecurityPopup(false)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <FaTimes className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mb-3 sm:mb-5 relative">
                    <input
                      type={showPasswordText ? "text" : "password"}
                      value={securityPassword}
                      onChange={(e) => setSecurityPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordVerify()}
                      placeholder="Enter password..."
                      autoFocus
                      className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                    >
                      {showPasswordText ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                    </button>
                    {passwordError && (
                      <p className="text-xs font-semibold text-red-500 mt-2">{passwordError}</p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowSecurityPopup(false)}
                      className="flex-1 px-4 py-2 sm:py-2.5 bg-white border-2 border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePasswordVerify}
                      disabled={settingsSaving || !securityPassword}
                      className="flex-1 flex items-center justify-center px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
                    >
                      {settingsSaving ? <FaSpinner className="w-4 h-4 animate-spin" /> : "Verify"}
                    </button>
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  </AdminNavigation>
  );
};

export default AdminInternLocations;
