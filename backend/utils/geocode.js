const axios = require("axios");

const SRI_LANKA_DISTRICTS = [
  "Ampara","Anuradhapura","Badulla","Batticaloa","Colombo",
  "Galle","Gampaha","Hambantota","Jaffna","Kalutara",
  "Kandy","Kegalle","Kilinochchi","Kurunegala","Mannar",
  "Matale","Matara","Monaragala","Mullaitivu","Nuwara Eliya",
  "Polonnaruwa","Puttalam","Ratnapura","Trincomalee","Vavuniya"
];

// Sri Lanka bounding box
const SL_VIEWBOX = "79.5,5.9,81.9,9.9";

// Increased to 1500ms — safer margin for bulk runs
const NOMINATIM_DELAY_MS = 1500;

// On ECONNRESET / network errors, wait this long then retry
const RETRY_DELAY_MS = 10000; // 10 seconds
const MAX_REQUEST_RETRIES = 3;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------------- CLEAN ADDRESS ---------------- */
const cleanAddress = (address) => {
  return address
    .replace(/["']/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[/\\:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/* ---------------- DISTRICT NORMALIZER ---------------- */
const normalizeDistrict = (value) => {
  if (!value) return null;

  const cleaned = value
    .replace(/district/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const exact = SRI_LANKA_DISTRICTS.find(
    d => d.toLowerCase() === cleaned.toLowerCase()
  );
  if (exact) return exact;

  return SRI_LANKA_DISTRICTS.find(
    d => cleaned.toLowerCase().includes(d.toLowerCase())
  ) || null;
};

/* ---------------- COUNTRY VALIDATION ---------------- */
const isInSriLanka = (result) => {
  const addr = result.address || {};
  const country = (addr.country || "").toLowerCase();
  const countryCode = (addr.country_code || "").toLowerCase();
  if (country && !country.includes("sri lanka")) return false;
  if (countryCode && countryCode !== "lk") return false;
  return true;
};

/* ---------------- AXIOS WITH RETRY ────────────────────────────────────────
   Wraps axios.get with automatic retry on ECONNRESET / network errors.
   Each retry waits progressively longer before trying again.
   Returns null (don't throw) so the caller can move to the next attempt.
---------------------------------------------------------------------------- */
const axiosGetWithRetry = async (url, params) => {
  for (let attempt = 1; attempt <= MAX_REQUEST_RETRIES; attempt++) {
    try {
      await sleep(NOMINATIM_DELAY_MS);
      const response = await axios.get(url, {
        params,
        headers: { "User-Agent": "TalentHub-Intern-System/2.0" },
        timeout: 15000,
      });
      return response;
    } catch (err) {
      const isNetworkError = (
        err.code === "ECONNRESET" ||
        err.code === "ECONNREFUSED" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ENOTFOUND" ||
        err.response?.status === 429 // rate limited
      );

      if (isNetworkError && attempt < MAX_REQUEST_RETRIES) {
        const waitMs = RETRY_DELAY_MS * attempt; // 10s, 20s, 30s
        console.log(
          `  ⚠ Network error (${err.code || err.response?.status}) on attempt ${attempt}/${MAX_REQUEST_RETRIES} — waiting ${waitMs / 1000}s before retry...`
        );
        await sleep(waitMs);
        continue;
      }

      // Non-network error or out of retries — log and return null
      console.log(
        `  ⚠ Request failed after ${attempt} attempt(s): ${err.message}`
      );
      return null;
    }
  }
  return null;
};

/* ---------------- REVERSE GEOCODE ---------------- */
const reverseGeocode = async (lat, lon) => {
  try {
    const res = await axiosGetWithRetry(
      "https://nominatim.openstreetmap.org/reverse",
      { lat, lon, format: "json", addressdetails: 1 }
    );
    if (!res) return null;

    const addr = res.data?.address;
    if (!addr) return null;

    const cc = (addr.country_code || "").toLowerCase();
    if (cc && cc !== "lk") return null;

    return (
      normalizeDistrict(addr.county) ||
      normalizeDistrict(addr.state_district) ||
      normalizeDistrict(addr.state) ||
      null
    );
  } catch {
    return null;
  }
};

/* ---------------- BUILD ATTEMPT LIST ---------------- */
const buildAttempts = (cleaned) => {
  const attempts = [];

  // 1. Full cleaned address
  attempts.push(cleaned);

  // 2. Split on commas AND hyphens (right to left)
  const parts = cleaned
    .split(/[,\-]/)
    .map(p => p.trim())
    .filter(p => p.length > 2);

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (!attempts.includes(part)) attempts.push(part);
  }

  // 3. Individual words > 3 chars (last resort)
  const words = cleaned
    .split(/[\s,\-]+/)
    .map(w => w.trim())
    .filter(w => w.length > 3);

  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (!attempts.includes(word)) attempts.push(word);
  }

  return attempts;
};

/* ---------------- MAIN GEOCODE FUNCTION ---------------- */
const geocodeAddress = async (address) => {
  try {
    if (!address || address.trim() === "") return null;

    const cleaned = cleanAddress(address);
    const attempts = buildAttempts(cleaned);

    for (const query of attempts) {
      // Try with bounding box first
      let response = await axiosGetWithRetry(
        "https://nominatim.openstreetmap.org/search",
        {
          q: `${query}, Sri Lanka`,
          format: "json",
          addressdetails: 1,
          countrycodes: "lk",
          viewbox: SL_VIEWBOX,
          bounded: 1,
          limit: 1,
        }
      );

      // Fallback without bounded if no results
      if (!response?.data?.length) {
        response = await axiosGetWithRetry(
          "https://nominatim.openstreetmap.org/search",
          {
            q: `${query}, Sri Lanka`,
            format: "json",
            addressdetails: 1,
            countrycodes: "lk",
            limit: 1,
          }
        );
      }

      if (!response?.data?.length) continue;

      const result = response.data[0];

      if (!isInSriLanka(result)) {
        console.log(`  ⚠ Result for "${query}" outside Sri Lanka — skipping`);
        continue;
      }

      const latitude = parseFloat(result.lat);
      const longitude = parseFloat(result.lon);

      if (isNaN(latitude) || isNaN(longitude)) continue;

      // Validate coordinates within Sri Lanka bounding box
      if (
        longitude < 79.5 || longitude > 81.9 ||
        latitude < 5.9   || latitude > 9.9
      ) {
        console.log(`  ⚠ Coordinates for "${query}" outside Sri Lanka bounds — skipping`);
        continue;
      }

      let district =
        normalizeDistrict(result.address?.county) ||
        normalizeDistrict(result.address?.state_district) ||
        normalizeDistrict(result.address?.state);

      if (!district) {
        district = await reverseGeocode(latitude, longitude);
      }

      if (!district) continue;

      return {
        location: {
          type: "Point",
          coordinates: [longitude, latitude]
        },
        district
      };
    }

    return null;

  } catch (err) {
    console.log("Geocode error:", err.message);
    return null;
  }
};

module.exports = geocodeAddress;