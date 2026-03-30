const axios = require("axios");
const config = require("../config/dotenv");

/**
 * Calls the external trainees API and returns normalized intern objects.
 * External payload shape:
 * {
 *   Trainee_ID, Trainee_Name, Trainee_HomeAddress, Training_StartDate, Training_EndDate,
 *   Trainee_Email, Institute, field_of_spec_name
 * }
 */
class TraineesApiService {
  constructor() {
    this.client = axios.create({
      baseURL: config.traineesApi.baseUrl,
      timeout: config.traineesApi.timeoutMs,
      headers: { "Content-Type": "application/json" },
      // baseURL provided is the full URL to resource; axios.create with baseURL works with path "".
    });
  }

  /**
   * Fetch all active trainees from external API.
   * Returns array of normalized interns for our system.
   */
  async fetchAllActive() {
    if (!config.traineesApi.secretKey) {
      throw new Error("TRAINEES_API_SECRET_KEY is not configured");
    }

    // Some APIs expect POST with body containing secretKey; if it's GET, we can adapt later.
    try {
      const { data } = await this.client.post("", { secretKey: config.traineesApi.secretKey });

      // Some APIs wrap the payload
      let rows = null;
      if (Array.isArray(data)) {
        rows = data;
      } else if (data && typeof data === 'object') {
        if (data.isSuccess === false) {
          const msg = data.errorMessage || 'API indicated failure';
          throw new Error(msg);
        }
        const bundle = data.dataBundle;
        if (Array.isArray(bundle)) {
          rows = bundle;
        } else if (bundle && typeof bundle === 'object') {
          // Take first array property inside dataBundle
          const firstArray = Object.values(bundle).find((v) => Array.isArray(v));
          if (Array.isArray(firstArray)) rows = firstArray;
        }
      }

      if (!Array.isArray(rows)) {
        throw new Error("Unexpected API response shape (no array found)");
      }

      return rows.map((item) => this.#mapExternalToInternal(item)).filter(Boolean);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`Trainees API error${status ? ` (${status})` : ""}: ${detail}`);
    }
  }

  /**
   * Map external API trainee to internal Intern model shape (not persisted).
   */
  #mapExternalToInternal(ext) {
    if (!ext) return null;
    return {
      traineeId: String(ext.Trainee_ID ?? "").trim(),
      traineeName: String(ext.Trainee_Name ?? "").trim(),
      homeAddress: String(ext.Trainee_HomeAddress ?? "").trim(),
      trainingStartDate: ext.Training_StartDate ? new Date(ext.Training_StartDate) : undefined,
      trainingEndDate: ext.Training_EndDate ? new Date(ext.Training_EndDate) : undefined,
      email: String(ext.Trainee_Email ?? "").trim(),
      institute: String(ext.Institute ?? "").trim(),
      fieldOfSpecialization: String(ext.field_of_spec_name ?? "").trim(),
      team: "",
      attendance: [],
    };
  }
}

module.exports = new TraineesApiService();
