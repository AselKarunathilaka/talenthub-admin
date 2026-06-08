const crypto = require("crypto");
const dotenv = require("../config/dotenv");

const PIN_WINDOW_MS = 5 * 60 * 1000;
const PIN_LENGTH = 6;
const meetingPinStates = new Map();

function getPinSecret() {
  return process.env.FACE_MEETING_PIN_SECRET || process.env.TALENTHUB_FEDERATION_SECRET || dotenv.jwtSecret;
}

function normalizeProjectName(projectName) {
  return String(projectName || "").trim().replace(/\s+/g, " ");
}

function getProjectKey(projectName) {
  return normalizeProjectName(projectName);
}

function getPinVersion(projectName) {
  return meetingPinStates.get(getProjectKey(projectName))?.version || 0;
}

function assertProjectName(projectName) {
  const normalizedName = normalizeProjectName(projectName);

  if (!normalizedName) {
    const error = new Error("Project name is required to generate a face attendance PIN.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedName;
}

function rotatePin(projectName) {
  const normalizedName = assertProjectName(projectName);
  const key = getProjectKey(normalizedName);
  const nextVersion = getPinVersion(normalizedName) + 1;

  meetingPinStates.set(key, {
    version: nextVersion,
    sessionId: null,
    issuedAt: null,
    expiresAt: 0,
  });

  return nextVersion;
}

function activatePin(projectName, now = Date.now()) {
  const normalizedName = assertProjectName(projectName);
  const key = getProjectKey(normalizedName);
  const nextVersion = getPinVersion(normalizedName) + 1;
  const state = {
    version: nextVersion,
    sessionId: crypto.randomUUID(),
    issuedAt: now,
    expiresAt: now + PIN_WINDOW_MS,
  };

  meetingPinStates.set(key, state);
  return state;
}

function getActivePinState(projectName, now = Date.now()) {
  const normalizedName = assertProjectName(projectName);
  const state = meetingPinStates.get(getProjectKey(normalizedName));

  if (!state?.issuedAt || state.expiresAt <= now) {
    return activatePin(normalizedName, now);
  }

  return state;
}

function buildPin(projectName, issuedAt, version) {
  const secret = getPinSecret();
  const normalizedName = assertProjectName(projectName);

  if (!secret) {
    throw new Error("Face meeting PIN secret is not configured.");
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${getProjectKey(normalizedName)}:${issuedAt}:${version}`)
    .digest();
  const number = digest.readUInt32BE(0) % (10 ** PIN_LENGTH);
  return String(number).padStart(PIN_LENGTH, "0");
}

function getCurrentPin(projectName, now = Date.now(), options = {}) {
  const normalizedName = assertProjectName(projectName);
  const state = options.rotate ? activatePin(normalizedName, now) : getActivePinState(normalizedName, now);

  return {
    projectName: normalizedName,
    meetingTitle: normalizedName,
    meetingSessionId: state.sessionId,
    pin: buildPin(normalizedName, state.issuedAt, state.version),
    expiresAt: new Date(state.expiresAt),
    generatedAt: new Date(state.issuedAt),
    ttlSeconds: Math.max(0, Math.ceil((state.expiresAt - now) / 1000)),
  };
}

function validatePin({ projectName, meetingTitle, pin, now = Date.now(), bypassValidation = false }) {
  const normalizedName = assertProjectName(projectName || meetingTitle);
  
  if (bypassValidation) {
    const state = meetingPinStates.get(getProjectKey(normalizedName));
    return {
      meetingSessionId: state?.sessionId || crypto.randomUUID(),
      projectName: normalizedName,
      meetingTitle: normalizedName,
      expiresAt: state ? new Date(state.expiresAt) : new Date(now + PIN_WINDOW_MS),
    };
  }

  const submittedPin = String(pin || "").trim();

  if (!submittedPin) {
    const error = new Error("Face attendance PIN is required for meeting attendance.");
    error.statusCode = 400;
    throw error;
  }

  if (!/^\d{6}$/.test(submittedPin)) {
    const error = new Error("Face attendance PIN must be 6 digits.");
    error.statusCode = 400;
    throw error;
  }

  const state = meetingPinStates.get(getProjectKey(normalizedName));
  const expectedPin =
    state?.issuedAt && state.expiresAt > now
      ? buildPin(normalizedName, state.issuedAt, state.version)
      : "";
  const expectedBuffer = Buffer.from(expectedPin);
  const submittedBuffer = Buffer.from(submittedPin);
  const isValid =
    expectedBuffer.length === submittedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, submittedBuffer);

  if (!isValid) {
    const error = new Error("Invalid or expired face attendance PIN.");
    error.statusCode = 403;
    throw error;
  }

  return {
    meetingSessionId: state.sessionId,
    projectName: normalizedName,
    meetingTitle: normalizedName,
    expiresAt: new Date(state.expiresAt),
  };
}

module.exports = {
  getCurrentPin,
  rotatePin,
  validatePin,
};
