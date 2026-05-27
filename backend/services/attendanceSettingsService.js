const AttendanceSetting = require("../models/AttendanceSetting");

const DEFAULT_KEY = "default";
const SLT_LAT = 6.9271;
const SLT_LNG = 79.8612;
const MAX_DISTANCE_METERS = 2000;

function getDistanceFromLatLonInMeters(lat1, lon1, lat2 = SLT_LAT, lon2 = SLT_LNG) {
  function deg2rad(deg) {
    return deg * (Math.PI / 180);
  }

  const R = 6371000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

async function getAttendanceSettings() {
  const settings = await AttendanceSetting.findOneAndUpdate(
    { key: DEFAULT_KEY },
    { $setOnInsert: { key: DEFAULT_KEY, sltLocationRequired: true } },
    { new: true, upsert: true },
  ).lean();

  return {
    sltLocationRequired: settings.sltLocationRequired !== false,
    updatedAt: settings.updatedAt,
  };
}

async function updateAttendanceSettings({ sltLocationRequired, updatedBy = null }) {
  const settings = await AttendanceSetting.findOneAndUpdate(
    { key: DEFAULT_KEY },
    {
      $set: {
        sltLocationRequired: Boolean(sltLocationRequired),
        updatedBy,
      },
      $setOnInsert: { key: DEFAULT_KEY },
    },
    { new: true, upsert: true },
  ).lean();

  return {
    sltLocationRequired: settings.sltLocationRequired !== false,
    updatedAt: settings.updatedAt,
  };
}

async function validateSltLocationIfRequired({ lat, lng, label = "Attendance" }) {
  const settings = await getAttendanceSettings();

  if (!settings.sltLocationRequired) {
    return {
      required: false,
      valid: true,
      distanceMeters: null,
    };
  }

  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    const error = new Error("Location data is required to mark attendance.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  const distance = getDistanceFromLatLonInMeters(Number(lat), Number(lng));
  if (!Number.isFinite(distance)) {
    const error = new Error("Valid location data is required to mark attendance.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  if (distance > MAX_DISTANCE_METERS) {
    const error = new Error(
      `${label} can only be marked within SLT premises. Your location is ${Math.round(distance)} meters away.`,
    );
    error.statusCode = 403;
    error.locationRequired = true;
    error.distanceMeters = distance;
    throw error;
  }

  return {
    required: true,
    valid: true,
    distanceMeters: distance,
  };
}

async function validateSltLocationRequired({ lat, lng, label = "Attendance" }) {
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    const error = new Error("Location data is required to mark attendance.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  const distance = getDistanceFromLatLonInMeters(Number(lat), Number(lng));
  if (!Number.isFinite(distance)) {
    const error = new Error("Valid location data is required to mark attendance.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  if (distance > MAX_DISTANCE_METERS) {
    const error = new Error(
      `${label} can only be marked within SLT premises. Your location is ${Math.round(distance)} meters away.`,
    );
    error.statusCode = 403;
    error.locationRequired = true;
    error.distanceMeters = distance;
    throw error;
  }

  return {
    required: true,
    valid: true,
    distanceMeters: distance,
  };
}

module.exports = {
  getAttendanceSettings,
  updateAttendanceSettings,
  validateSltLocationIfRequired,
  validateSltLocationRequired,
};
