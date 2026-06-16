// services/sltApiService.js
const axios = require("axios");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

class SLTApiService {
  constructor() {
    this.apiUrl =
      "https://prohub.slt.com.lk/ProhubTrainees/api/MainApi/AllActiveTrainees";
    this.secretKey = process.env.TRAINEES_API_SECRET_KEY;
    this.timeout = 30000; // 30 seconds
    this.debug = false; // Disabled verbose logging for performance
  }

  async fetchActiveTrainees() {
    const startTime = Date.now();

    try {
      if (this.debug) {
        console.log("🔗 Fetching active trainees from SLT API...");
      }

      if (!this.secretKey) {
        throw new Error("API secret key is missing from environment variables");
      }

      const requestBody = { secretKey: this.secretKey };

      const response = await axios.post(this.apiUrl, requestBody, {
        timeout: this.timeout,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Prohub Intern Management System/1.0",
        },
      });

      if (!response.data) {
        throw new Error("No data received from SLT API - Empty response body");
      }

      if (response.data.isSuccess === false) {
        throw new Error(
          `SLT API returned error: ${response.data.errorMessage || "Unknown error"}`,
        );
      }

      // Extract trainees data from different possible locations
      let traineesData = null;

      if (response.data.dataBundle && Array.isArray(response.data.dataBundle)) {
        traineesData = response.data.dataBundle;
      } else if (response.data && Array.isArray(response.data)) {
        traineesData = response.data;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        traineesData = response.data.data;
      } else {
        throw new Error(
          "Invalid response format from SLT API - No array found in expected locations",
        );
      }

      console.log(`✅ SLT API: ${traineesData.length} trainees fetched`);

      return traineesData;
    } catch (error) {
      console.error(`❌ SLT API Error:`, error.message);

      if (error.response) {
        switch (error.response.status) {
          case 401:
            throw new Error(
              "SLT API Authentication Failed (401) - Please check your secret key",
            );
          case 403:
            throw new Error(
              "SLT API Access Denied (403) - Check permissions or IP whitelisting",
            );
          case 404:
            throw new Error(
              "SLT API Endpoint Not Found (404) - Check the API URL",
            );
          case 500:
            throw new Error(
              "SLT API Server Error (500) - Service might be temporarily down",
            );
          default:
            throw new Error(
              `SLT API responded with status ${error.response.status}: ${error.response.statusText}`,
            );
        }
      } else if (error.request) {
        throw new Error(
          "No response received from SLT API - Check network connectivity",
        );
      } else {
        throw new Error(`Failed to fetch data from SLT API: ${error.message}`);
      }
    }
  }

  // Removed verbose analysis methods for performance

  // Optimized mapper
  mapToInternSchema(apiData) {
    if (!apiData || !Array.isArray(apiData)) {
      return [];
    }

    const mappedTrainees = apiData.map((trainee) => ({
      traineeId:
        this.getFieldValue(trainee, [
          "Trainee_ID",
          "traineeId",
          "id",
        ])?.toString() || "",
      traineeName:
        this.getFieldValue(trainee, [
          "Trainee_Name",
          "traineeName",
          "name",
          "TraineeName",
        ]) || "",
      homeAddress:
        this.getFieldValue(trainee, [
          "Trainee_HomeAddress",
          "HomeAddress",
          "Address",
        ]) || "",
      fieldOfSpecialization:
        this.getFieldValue(trainee, [
          "field_of_spec_name",
          "Field",
          "Specialization",
          "fieldOfSpecialization",
          "FieldOfStudy",
        ]) || "General Training",
      trainingStartDate: this.parseDate(
        this.getFieldValue(trainee, [
          "Training_StartDate",
          "startDate",
          "StartDate",
        ]),
      ),
      trainingEndDate: this.parseDate(
        this.getFieldValue(trainee, ["Training_EndDate", "endDate", "EndDate"]),
      ),
      institute:
        this.getFieldValue(trainee, [
          "Institute",
          "institute",
          "University",
          "College",
        ]) || "",
      email:
        this.getFieldValue(trainee, ["Trainee_Email", "email", "Email"]) || "",

      team: "",
      attendance: [],
      availableDays: [],
    }));

    return mappedTrainees;
  }

  // Fast test method
  async testConnection() {
    try {
      const trainees = await this.fetchActiveTrainees();

      return {
        success: true,
        message: "SLT API connection successful",
        count: trainees.length,
        sample: [],
        total: trainees.length,
      };
    } catch (error) {
      return {
        success: false,
        message: `SLT API connection failed: ${error.message}`,
        count: 0,
        sample: [],
        total: 0,
      };
    }
  }

  // Optimized database comparison
  async compareWithDatabase(internRepository) {
    try {
      const [apiTrainees, dbInterns] = await Promise.all([
        this.fetchActiveTrainees(),
        internRepository.getAllInterns(),
      ]);

      const apiTraineeIds = new Set(
        apiTrainees.map((t) => t.Trainee_ID?.toString()).filter(Boolean),
      );
      const dbTraineeIds = new Set(
        dbInterns
          .map((i) => (i.Trainee_ID || i.traineeId)?.toString())
          .filter(Boolean),
      );

      const inApiNotInDb = [...apiTraineeIds].filter(
        (id) => !dbTraineeIds.has(id),
      );
      const inDbNotInApi = [...dbTraineeIds].filter(
        (id) => !apiTraineeIds.has(id),
      );

      return {
        apiCount: apiTraineeIds.size,
        dbCount: dbTraineeIds.size,
        toAdd: inApiNotInDb.length,
        toReview: inDbNotInApi.length,
        inBoth: apiTraineeIds.size - inApiNotInDb.length,
      };
    } catch (error) {
      return null;
    }
  }

  // Helper method to get field value with fallbacks
  getFieldValue(obj, possibleKeys) {
    for (const key of possibleKeys) {
      if (
        obj &&
        obj[key] !== undefined &&
        obj[key] !== null &&
        obj[key] !== ""
      ) {
        return obj[key];
      }
    }
    return "";
  }

  // Helper method to parse dates safely
  parseDate(dateString) {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      return null;
    }
  }

  // Basic email validation
  isValidEmail(email) {
    if (typeof email !== "string") return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }
}

module.exports = new SLTApiService();