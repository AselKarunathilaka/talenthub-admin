const FACE_CAMERA_CONSTRAINTS = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    aspectRatio: { ideal: 4 / 3 },
    facingMode: { ideal: "user" },
  },
  audio: false,
};

const FALLBACK_CAMERA_CONSTRAINTS = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    aspectRatio: { ideal: 4 / 3 },
  },
  audio: false,
};

const LOW_POWER_CAMERA_CONSTRAINTS = {
  video: {
    width: { ideal: 480 },
    height: { ideal: 360 },
    facingMode: "user",
  },
  audio: false,
};

const BASIC_CAMERA_CONSTRAINTS = { video: true, audio: false };
const CAMERA_START_TIMEOUT_MS = 15000;

const getStreamWithTimeout = (constraints) => {
  let timedOut = false;
  let timeoutId;
  const streamPromise = navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    if (timedOut) stream.getTracks().forEach((track) => track.stop());
    return stream;
  });
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      const error = new Error("Camera took too long to start.");
      error.name = "CameraTimeoutError";
      reject(error);
    }, CAMERA_START_TIMEOUT_MS);
  });
  return Promise.race([streamPromise, timeoutPromise]).finally(() => window.clearTimeout(timeoutId));
};

export const getCameraErrorMessage = (error) => {
  const name = error?.name || "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission is blocked. Please allow camera access in your browser settings.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera is already in use by another app. Close other camera apps and try again.";
  }

  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "This device camera does not support the requested settings. Trying another camera mode may help.";
  }

  if (name === "CameraTimeoutError" || name === "AbortError") {
    return "Camera took too long to start. Close other camera apps, then retry.";
  }

  if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
    return "Camera access requires HTTPS. Please open TalentHub using the secure site link.";
  }

  return "Camera access failed. Please allow camera permission and try again.";
};

export const requestFaceCameraStream = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    const error = new Error("Camera access requires a supported browser on HTTPS or localhost.");
    error.name = "UnsupportedBrowser";
    throw error;
  }

  const constraintLevels = [
    FACE_CAMERA_CONSTRAINTS,
    FALLBACK_CAMERA_CONSTRAINTS,
    LOW_POWER_CAMERA_CONSTRAINTS,
    BASIC_CAMERA_CONSTRAINTS,
  ];
  let lastError;
  for (const constraints of constraintLevels) {
    try {
      return await getStreamWithTimeout(constraints);
    } catch (error) {
      lastError = error;
      if (["NotAllowedError", "PermissionDeniedError", "NotFoundError", "DevicesNotFoundError", "NotReadableError", "TrackStartError"].includes(error?.name)) throw error;
    }
  }
  throw lastError;
};

export const waitForPlayableVideo = async (video, timeoutMs = 8000) => {
  if (!video) throw new Error("Camera preview is unavailable.");
  if (video.readyState >= 2 && video.videoWidth > 0) {
    await video.play();
    return;
  }
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("error", failed);
    };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("Camera preview could not start.")); };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error("Camera preview took too long to start.")); }, timeoutMs);
    video.addEventListener("loadeddata", ready, { once: true });
    video.addEventListener("error", failed, { once: true });
  });
  await video.play();
};
