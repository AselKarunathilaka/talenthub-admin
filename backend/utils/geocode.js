const axios = require("axios");

const SRI_LANKA_DISTRICTS = [
  "Ampara","Anuradhapura","Badulla","Batticaloa","Colombo",
  "Galle","Gampaha","Hambantota","Jaffna","Kalutara",
  "Kandy","Kegalle","Kilinochchi","Kurunegala","Mannar",
  "Matale","Matara","Monaragala","Mullaitivu","Nuwara Eliya",
  "Polonnaruwa","Puttalam","Ratnapura","Trincomalee","Vavuniya"
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ---------------- CLEAN ADDRESS ---------------- */
const cleanAddress = (address) => {
  return address
    .replace(/["']/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[0-9/:-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

/* ---------------- DISTRICT NORMALIZER ---------------- */
const normalizeDistrict = (value) => {
  if (!value) return null;

  value = value.replace(/district/i, "").trim();

  return SRI_LANKA_DISTRICTS.find(
    d => d.toLowerCase() === value.toLowerCase()
  ) || null;
};

/* ---------------- REVERSE VALIDATION ---------------- */
const reverseGeocode = async (lat, lon) => {
  try {
    const res = await axios.get(
      "https://nominatim.openstreetmap.org/reverse",
      {
        params: {
          lat,
          lon,
          format: "json",
          addressdetails: 1
        },
        headers: { "User-Agent": "TalentHub-System" }
      }
    );

    const addr = res.data.address;

    return (
      normalizeDistrict(addr?.county) ||
      normalizeDistrict(addr?.state_district) ||
      normalizeDistrict(addr?.state)
    );
  } catch {
    return null;
  }
};

/* ---------------- MAIN GEOCODE FUNCTION ---------------- */
const geocodeAddress = async (address) => {
  try {
    if (!address || address.trim() === "") return null;

    const cleaned = cleanAddress(address);

    const attempts = [];

    // 1️⃣ Full address
    attempts.push(cleaned);

    // 2️⃣ Word-by-word fallback (from end)
    const words = cleaned
      .split(/,|\s/)
      .filter(w => w.length > 3);

    for (let i = words.length - 1; i >= 0; i--) {
      attempts.push(words[i]);
    }

    for (const query of attempts) {

      const response = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: {
            q: `${query}, Sri Lanka`,
            format: "json",
            addressdetails: 1,
            limit: 1
          },
          headers: { "User-Agent": "TalentHub-System" }
        }
      );

      if (!response.data || response.data.length === 0) {
        await sleep(800);
        continue;
      }

      const result = response.data[0];

      const latitude = parseFloat(result.lat);
      const longitude = parseFloat(result.lon);

      let district =
        normalizeDistrict(result.address?.county) ||
        normalizeDistrict(result.address?.state_district) ||
        normalizeDistrict(result.address?.state);

      // Reverse validate district
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