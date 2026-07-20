import { apiFetch } from "./api";

const readResponse = async (response) => {
  try { return await response.json(); }
  catch { return {}; }
};

export const enrollFaceSamples = async ({ descriptors, metadata = {} }) => {
  const batchResponse = await apiFetch("/face-attendance/enroll-batch", {
    method: "POST",
    body: JSON.stringify({ descriptors, metadata }),
  });

  if (batchResponse.ok) return readResponse(batchResponse);
  if (![404, 405].includes(batchResponse.status)) {
    const result = await readResponse(batchResponse);
    throw new Error(result.message || `Face enrollment failed (${batchResponse.status}).`);
  }

  // Supports deployments where the frontend is updated before the backend
  // process has restarted with the batch endpoint.
  for (const [index, descriptor] of descriptors.entries()) {
    const response = await apiFetch("/face-attendance/enroll", {
      method: "POST",
      body: JSON.stringify({ descriptor, metadata: { ...metadata, replaceExisting: index === 0 } }),
    });
    if (!response.ok) {
      const result = await readResponse(response);
      throw new Error(result.message || `Face enrollment failed (${response.status}).`);
    }
  }
  return { message: "Face profile saved successfully." };
};
