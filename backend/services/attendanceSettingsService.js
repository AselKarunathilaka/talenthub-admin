const AttendanceSetting = require("../models/AttendanceSetting");

const DEFAULT_KEY = "default";
const readNumberSetting = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
};
const SLT_LAT = readNumberSetting("ATTENDANCE_SLT_LAT", 6.9271);
const SLT_LNG = readNumberSetting("ATTENDANCE_SLT_LNG", 79.8612);
const MAX_DISTANCE_METERS = readNumberSetting("ATTENDANCE_MAX_DISTANCE_METERS", 2000);
const MAX_LOCATION_ACCURACY_METERS = readNumberSetting("ATTENDANCE_MAX_LOCATION_ACCURACY_METERS", 500);
const MAX_LOCATION_AGE_MS = readNumberSetting("ATTENDANCE_MAX_LOCATION_AGE_MS", 2 * 60 * 1000);

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
    locationPolicy: {
      latitude: SLT_LAT,
      longitude: SLT_LNG,
      radiusMeters: MAX_DISTANCE_METERS,
      maxAccuracyMeters: MAX_LOCATION_ACCURACY_METERS,
      maxAgeMs: MAX_LOCATION_AGE_MS,
    },
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
    locationPolicy: {
      latitude: SLT_LAT,
      longitude: SLT_LNG,
      radiusMeters: MAX_DISTANCE_METERS,
      maxAccuracyMeters: MAX_LOCATION_ACCURACY_METERS,
      maxAgeMs: MAX_LOCATION_AGE_MS,
    },
  };
}

function validateLocationEvidence({ lat, lng, accuracy, capturedAt, label = "Attendance" }) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const locationAccuracy = Number(accuracy);
  const capturedAtDate = new Date(capturedAt);
  const ageMs = Date.now() - capturedAtDate.getTime();

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    const error = new Error("Valid location data is required to mark attendance.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  if (!Number.isFinite(locationAccuracy) || locationAccuracy < 0) {
    const error = new Error("A fresh GPS accuracy reading is required. Refresh your location and try again.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  if (locationAccuracy > MAX_LOCATION_ACCURACY_METERS) {
    const error = new Error(
      `Your GPS reading is not accurate enough to mark ${label.toLowerCase()}. Move near a window, enable precise location, and try again.`,
    );
    error.statusCode = 400;
    error.locationRequired = true;
    error.accuracyMeters = locationAccuracy;
    throw error;
  }

  if (!Number.isFinite(capturedAtDate.getTime()) || ageMs < -30000 || ageMs > MAX_LOCATION_AGE_MS) {
    const error = new Error("Your location reading is stale. Refresh your location and try again.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  const distance = getDistanceFromLatLonInMeters(latitude, longitude);
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
    valid: true,
    latitude,
    longitude,
    accuracyMeters: locationAccuracy,
    capturedAt: capturedAtDate,
    distanceMeters: distance,
    validatedAt: new Date(),
  };
}

async function validateSltLocationIfRequired({ lat, lng, accuracy, capturedAt, label = "Attendance" }) {
  const settings = await getAttendanceSettings();

  if (!settings.sltLocationRequired) {
    return {
      required: false,
      valid: true,
      distanceMeters: null,
      validatedAt: new Date(),
    };
  }

  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    const error = new Error("Location data is required to mark attendance.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  return {
    required: true,
    ...validateLocationEvidence({ lat, lng, accuracy, capturedAt, label }),
  };
}

async function validateSltLocationRequired({ lat, lng, accuracy, capturedAt, label = "Attendance" }) {
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    const error = new Error("Location data is required to mark attendance.");
    error.statusCode = 400;
    error.locationRequired = true;
    throw error;
  }

  return {
    required: true,
    ...validateLocationEvidence({ lat, lng, accuracy, capturedAt, label }),
  };
}

module.exports = {
  getAttendanceSettings,
  updateAttendanceSettings,
  validateSltLocationIfRequired,
  validateSltLocationRequired,
};
