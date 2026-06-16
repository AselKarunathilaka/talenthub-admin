import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";

let lastSubmitCall = 0;
const MIN_INTERVAL_MS = 4000; // 15 RPM ≈ one call every 4 seconds

/**
 * Rate-limited POST to the batch validation endpoint (submit-time only).
 */
export async function rateLimitedBatchValidate(data) {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastSubmitCall));
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastSubmitCall = Date.now();

  const authToken = localStorage.getItem("authToken");

  return fetch(`${API_BASE_URL}${API_ENDPOINTS.RECORDS.VALIDATE_BATCH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(data),
  });
}
