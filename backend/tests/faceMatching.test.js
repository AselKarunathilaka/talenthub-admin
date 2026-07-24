const assert = require("node:assert/strict");
const test = require("node:test");
const FaceAttendanceService = require("../services/faceAttendanceService");

const descriptor = (value = 0) => Array.from({ length: 128 }, () => value);

test("accepts only finite 128-value face descriptors", () => {
  assert.equal(FaceAttendanceService.normalizeDescriptor(descriptor(0.1)).length, 128);
  assert.equal(FaceAttendanceService.normalizeDescriptor(descriptor(0.1).slice(1)), null);
  assert.equal(
    FaceAttendanceService.normalizeDescriptor([...descriptor(0.1).slice(0, 127), Number.NaN]),
    null,
  );
});

test("calculates stable Euclidean face distances", () => {
  assert.equal(FaceAttendanceService.calculateDistance(descriptor(0), descriptor(0)), 0);
  assert.equal(
    FaceAttendanceService.calculateDistance(descriptor(0), descriptor(0.1)).toFixed(6),
    Math.sqrt(128 * 0.1 * 0.1).toFixed(6),
  );
  assert.equal(
    FaceAttendanceService.calculateDistance(descriptor(0), descriptor(0).slice(1)),
    Number.POSITIVE_INFINITY,
  );
});
