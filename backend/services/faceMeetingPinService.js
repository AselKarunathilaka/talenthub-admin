const crypto = require("crypto");
const dotenv = require("../config/dotenv");

const PIN_WINDOW_MS = 5 * 60 * 1000;
const PIN_LENGTH = 6;
const meetingPinStates = new Map();

function getPinSecret() {
  return process.env.FACE_MEETING_PIN_SECRET || process.env.TALENTHUB_FEDERATION_SECRET || dotenv.jwtSecret;
}

function normalizeMeetingTitle(meetingTitle) {
  return String(meetingTitle || "").trim();
}

function getMeetingKey(meetingTitle) {
  return normalizeMeetingTitle(meetingTitle).toLowerCase();
}

function getPinVersion(meetingTitle) {
  return meetingPinStates.get(getMeetingKey(meetingTitle))?.version || 0;
}

function assertMeetingTitle(meetingTitle) {
  const normalizedTitle = normalizeMeetingTitle(meetingTitle);

  if (!normalizedTitle) {
    const error = new Error("Meeting title is required to generate a face attendance PIN.");
    error.statusCode = 400;
    throw error;
  }

  return normalizedTitle;
}

function rotatePin(meetingTitle) {
  const normalizedTitle = assertMeetingTitle(meetingTitle);
  const key = getMeetingKey(normalizedTitle);
  const nextVersion = getPinVersion(normalizedTitle) + 1;

  meetingPinStates.set(key, {
    version: nextVersion,
    sessionId: null,
    issuedAt: null,
    expiresAt: 0,
  });

  return nextVersion;
}

function activatePin(meetingTitle, now = Date.now()) {
  const normalizedTitle = assertMeetingTitle(meetingTitle);
  const key = getMeetingKey(normalizedTitle);
  const nextVersion = getPinVersion(normalizedTitle) + 1;
  const state = {
    version: nextVersion,
    sessionId: crypto.randomUUID(),
    issuedAt: now,
    expiresAt: now + PIN_WINDOW_MS,
  };

  meetingPinStates.set(key, state);
  return state;
}

function getActivePinState(meetingTitle, now = Date.now()) {
  const normalizedTitle = assertMeetingTitle(meetingTitle);
  const state = meetingPinStates.get(getMeetingKey(normalizedTitle));

  if (!state?.issuedAt || state.expiresAt <= now) {
    return activatePin(normalizedTitle, now);
  }

  return state;
}

function buildPin(meetingTitle, issuedAt, version) {
  const secret = getPinSecret();
  const normalizedTitle = assertMeetingTitle(meetingTitle);

  if (!secret) {
    throw new Error("Face meeting PIN secret is not configured.");
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${normalizedTitle}:${issuedAt}:${version}`)
    .digest();
  const number = digest.readUInt32BE(0) % (10 ** PIN_LENGTH);
  return String(number).padStart(PIN_LENGTH, "0");
}

function getCurrentPin(meetingTitle, now = Date.now(), options = {}) {
  const normalizedTitle = assertMeetingTitle(meetingTitle);
  const state = options.rotate ? activatePin(normalizedTitle, now) : getActivePinState(normalizedTitle, now);

  return {
    meetingTitle: normalizedTitle,
    meetingSessionId: state.sessionId,
    pin: buildPin(normalizedTitle, state.issuedAt, state.version),
    expiresAt: new Date(state.expiresAt),
    generatedAt: new Date(state.issuedAt),
    ttlSeconds: Math.max(0, Math.ceil((state.expiresAt - now) / 1000)),
  };
}

function validatePin({ meetingTitle, pin, now = Date.now() }) {
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

  const normalizedTitle = assertMeetingTitle(meetingTitle);
  const state = meetingPinStates.get(getMeetingKey(normalizedTitle));
  const expectedPin =
    state?.issuedAt && state.expiresAt > now
      ? buildPin(normalizedTitle, state.issuedAt, state.version)
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
    meetingTitle: normalizedTitle,
    expiresAt: new Date(state.expiresAt),
  };
}

module.exports = {
  getCurrentPin,
  rotatePin,
  validatePin,
};
