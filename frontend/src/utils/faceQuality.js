export const checkLighting = (videoElement) => {
  if (!videoElement || videoElement.videoWidth === 0) return true;
  
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let sum = 0;
  let minBrightness = 255;
  let maxBrightness = 0;
  
  for (let i = 0; i < imageData.length; i += 4) {
    // Calculate apparent brightness (grayscale)
    const brightness = (imageData[i] * 0.299 + imageData[i + 1] * 0.587 + imageData[i + 2] * 0.114);
    sum += brightness;
    if (brightness < minBrightness) minBrightness = brightness;
    if (brightness > maxBrightness) maxBrightness = brightness;
  }
  
  const avgBrightness = sum / (canvas.width * canvas.height);
  const contrast = maxBrightness - minBrightness;
  
  // Bright enough and not washed out / heavily backlit (contrast check)
  return avgBrightness > 40 && contrast > 30;
};

export const checkDistance = (detection, videoElement) => {
  if (!detection || !videoElement || videoElement.videoWidth === 0) return true;
  
  // Box width should be at least 15% of the video width
  const minFaceWidth = videoElement.videoWidth * 0.15;
  return detection.box.width >= minFaceWidth;
};
