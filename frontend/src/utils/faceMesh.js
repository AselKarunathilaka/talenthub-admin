const FACE_MESH_PATHS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  [17, 18, 19, 20, 21],
  [22, 23, 24, 25, 26],
  [27, 28, 29, 30],
  [31, 32, 33, 34, 35],
  [36, 37, 38, 39, 40, 41, 36],
  [42, 43, 44, 45, 46, 47, 42],
  [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 48],
  [60, 61, 62, 63, 64, 65, 66, 67, 60],
  [17, 27, 22],
  [19, 28, 24],
  [36, 27, 42],
  [39, 30, 42],
  [31, 33, 35],
  [48, 57, 54],
  [3, 31, 48],
  [13, 35, 54],
  [5, 48, 8, 54, 11],
];

export const clearFaceMesh = (canvas) => {
  if (!canvas) return;
  canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
};

export const drawFaceMesh = (canvas, landmarks) => {
  if (!canvas || !landmarks?.positions?.length) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const points = landmarks.positions;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 0.85;
  context.strokeStyle = "rgba(167, 243, 208, 0.7)";
  context.fillStyle = "rgba(236, 253, 245, 0.9)";
  context.shadowColor = "rgba(16, 185, 129, 0.42)";
  context.shadowBlur = 3;

  FACE_MESH_PATHS.forEach((path) => {
    context.beginPath();
    path.forEach((pointIndex, index) => {
      const point = points[pointIndex];
      if (!point) return;
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();
  });

  points.forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, 1.65, 0, Math.PI * 2);
    context.fill();
  });

  context.shadowBlur = 0;
};
