import * as faceapi from "face-api.js";

const hardwareConcurrency = Number(navigator.hardwareConcurrency || 4);
const deviceMemory = Number(navigator.deviceMemory || 4);
const compactViewport = window.matchMedia?.("(max-width: 768px)")?.matches === true;

export const isLowPowerFaceDevice =
  hardwareConcurrency <= 4 || deviceMemory <= 4 || compactViewport;

export const faceRuntimeProfile = {
  captureLongEdge: isLowPowerFaceDevice ? 480 : 720,
  detectorInputSize: isLowPowerFaceDevice ? 224 : 320,
  guideInputSize: isLowPowerFaceDevice ? 128 : 160,
  guideIntervalMs: isLowPowerFaceDevice ? 950 : 600,
  stableChecks: isLowPowerFaceDevice ? 2 : 3,
};

export const createFaceDetectorOptions = ({ guide = false } = {}) =>
  new faceapi.TinyFaceDetectorOptions({
    inputSize: guide
      ? faceRuntimeProfile.guideInputSize
      : faceRuntimeProfile.detectorInputSize,
    scoreThreshold: guide ? 0.45 : 0.5,
  });

const getCaptureDimensions = (video, maxLongEdge) => {
  const sourceWidth = Number(video?.videoWidth || 640);
  const sourceHeight = Number(video?.videoHeight || 480);
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;

  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
};

export const drawFaceVideoFrame = (
  video,
  canvas,
  overlayCanvas = null,
  { maxLongEdge = faceRuntimeProfile.captureLongEdge } = {},
) => {
  if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  const dimensions = getCaptureDimensions(video, maxLongEdge);
  if (canvas.width !== dimensions.width) canvas.width = dimensions.width;
  if (canvas.height !== dimensions.height) canvas.height = dimensions.height;
  if (overlayCanvas) {
    if (overlayCanvas.width !== dimensions.width) overlayCanvas.width = dimensions.width;
    if (overlayCanvas.height !== dimensions.height) overlayCanvas.height = dimensions.height;
  }

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, 0, 0, dimensions.width, dimensions.height);
  return dimensions;
};

export const evaluateFacePlacement = (detection, dimensions) => {
  const box = detection?.detection?.box || detection?.box;
  if (!box || !dimensions?.width || !dimensions?.height) {
    return { ready: false, error: "Could not measure your face. Hold still and retry." };
  }

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const centered =
    Math.abs(centerX - dimensions.width / 2) <= dimensions.width * 0.22 &&
    Math.abs(centerY - dimensions.height / 2) <= dimensions.height * 0.22;
  const faceWidthRatio = box.width / dimensions.width;
  const faceHeightRatio = box.height / dimensions.height;

  if (!centered) {
    return { ready: false, error: "Move your face into the center oval." };
  }
  if (faceWidthRatio < 0.2 || faceHeightRatio < 0.24) {
    return { ready: false, error: "Move a little closer to the camera." };
  }
  if (faceWidthRatio > 0.82 || faceHeightRatio > 0.88) {
    return { ready: false, error: "Move slightly away from the camera." };
  }
  return { ready: true };
};

let lightingSampleCanvas = null;

const sampleFaceLighting = (canvas, detection) => {
  const context = canvas?.getContext("2d", { willReadFrequently: true });
  if (!context || !canvas.width || !canvas.height) return null;

  const box = detection?.detection?.box || detection?.box;
  if (!box) return null;

  const paddingX = box.width * 0.12;
  const paddingY = box.height * 0.12;
  const sourceX = Math.max(0, box.x - paddingX);
  const sourceY = Math.max(0, box.y - paddingY);
  const sourceWidth = Math.min(canvas.width - sourceX, box.width + paddingX * 2);
  const sourceHeight = Math.min(canvas.height - sourceY, box.height + paddingY * 2);
  if (sourceWidth <= 0 || sourceHeight <= 0) return null;

  const sampleWidth = 32;
  const sampleHeight = 24;
  const sampleCanvas = lightingSampleCanvas || document.createElement("canvas");
  lightingSampleCanvas = sampleCanvas;
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sampleContext) return null;
  sampleContext.drawImage(
    canvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sampleWidth,
    sampleHeight,
  );
  const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;

  let total = 0;
  let totalSquared = 0;
  const count = pixels.length / 4;
  for (let index = 0; index < pixels.length; index += 4) {
    const luminance =
      pixels[index] * 0.2126 +
      pixels[index + 1] * 0.7152 +
      pixels[index + 2] * 0.0722;
    total += luminance;
    totalSquared += luminance * luminance;
  }

  const mean = total / count;
  const deviation = Math.sqrt(Math.max(0, totalSquared / count - mean * mean));
  return { mean, deviation };
};

export const evaluateFaceCaptureQuality = (detection, canvas, dimensions) => {
  const placement = evaluateFacePlacement(detection, dimensions);
  if (!placement.ready) return placement;

  const score = Number(detection?.detection?.score ?? detection?.score ?? 0);
  if (score < 0.55) {
    return { ready: false, error: "Face is unclear. Hold still and improve the lighting." };
  }

  const lighting = sampleFaceLighting(canvas, detection);
  if (lighting?.mean < 42) {
    return { ready: false, error: "The image is too dark. Face a light source and retry." };
  }
  if (lighting?.mean > 238) {
    return { ready: false, error: "The image is too bright. Move away from direct light." };
  }
  if (lighting?.deviation < 16) {
    return { ready: false, error: "The image has low contrast. Improve the lighting and retry." };
  }

  return { ready: true };
};

export const descriptorDistance = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return Number.POSITIVE_INFINITY;
  }
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = Number(left[index]) - Number(right[index]);
    sum += difference * difference;
  }
  return Math.sqrt(sum);
};

export const isDistinctFaceDescriptor = (candidate, previous, minimumDistance = 0.035) =>
  !previous || descriptorDistance(candidate, previous) >= minimumDistance;
