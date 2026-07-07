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

  try {
    return await navigator.mediaDevices.getUserMedia(FACE_CAMERA_CONSTRAINTS);
  } catch (primaryError) {
    if (
      primaryError?.name === "OverconstrainedError" ||
      primaryError?.name === "ConstraintNotSatisfiedError"
    ) {
      return navigator.mediaDevices.getUserMedia(FALLBACK_CAMERA_CONSTRAINTS);
    }

    throw primaryError;
  }
};
