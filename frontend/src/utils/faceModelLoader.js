import * as faceapi from "face-api.js";

const configuredModelUrl =
  import.meta.env.VITE_FACE_MODEL_URL ||
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
const MODEL_URL = configuredModelUrl.endsWith("/") ? configuredModelUrl : `${configuredModelUrl}/`;
const MODEL_LOAD_TIMEOUT_MS = 45000;
let sharedLoadPromise = null;

const modelsAreReady = () =>
  faceapi.nets.tinyFaceDetector.isLoaded &&
  faceapi.nets.faceLandmark68Net.isLoaded &&
  faceapi.nets.faceRecognitionNet.isLoaded;

export const loadFaceModels = async () => {
  if (modelsAreReady()) return;
  if (!sharedLoadPromise) {
    sharedLoadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).catch((error) => {
      sharedLoadPromise = null;
      throw error;
    });
  }

  let timeoutId;
  try {
    await Promise.race([
      sharedLoadPromise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("Face models took too long to load. Check your connection and retry.")),
          MODEL_LOAD_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const faceModelUrl = MODEL_URL;
