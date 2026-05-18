const crypto = require("crypto");
const dotenv = require("../config/dotenv");

const PIN_WINDOW_MS = 5 * 60 * 1000;
const PIN_LENGTH = 6;

function getPinSecret() {
  return process.env.FACE_MEETING_PIN_SECRET || process.env.TALENTHUB_FEDERATION_SECRET || dotenv.jwtSecret;
}

function normalizeMeetingTitle(meetingTitle) {
  return String(meetingTitle || "").trim();
}

function getWindowStarts(now = Date.now()) {
  const currentWindowStart = Math.floor(now / PIN_WINDOW_MS) * PIN_WINDOW_MS;
  return [currentWindowStart];
}

function buildPin(meetingTitle, windowStart) {
  const secret = getPinSecret();
  const normalizedTitle = normalizeMeetingTitle(meetingTitle);

  if (!secret) {
    throw new Error("Face meeting PIN secret is not configured.");
  }

  if (!normalizedTitle) {
    const error = new Error("Meeting title is required to generate a face attendance PIN.");
    error.statusCode = 400;
    throw error;
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${normalizedTitle}:${windowStart}`)
    .digest();
  const number = digest.readUInt32BE(0) % (10 ** PIN_LENGTH);
  return String(number).padStart(PIN_LENGTH, "0");
}

function getCurrentPin(meetingTitle, now = Date.now()) {
  const [windowStart] = getWindowStarts(now);
  return {
    meetingTitle: String(meetingTitle || "").trim(),
    pin: buildPin(meetingTitle, windowStart),
    expiresAt: new Date(windowStart + PIN_WINDOW_MS),
    generatedAt: new Date(now),
    ttlSeconds: Math.max(0, Math.ceil((windowStart + PIN_WINDOW_MS - now) / 1000)),
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

  const isValid = getWindowStarts(now).some((windowStart) => {
    const expectedPin = buildPin(meetingTitle, windowStart);
    const expectedBuffer = Buffer.from(expectedPin);
    const submittedBuffer = Buffer.from(submittedPin);
    return (
      expectedBuffer.length === submittedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, submittedBuffer)
    );
  });

  if (!isValid) {
    const error = new Error("Invalid or expired face attendance PIN.");
    error.statusCode = 403;
    throw error;
  }

  return true;
}

module.exports = {
  getCurrentPin,
  validatePin,
};
