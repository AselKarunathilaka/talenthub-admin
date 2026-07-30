const express = require("express");
const axios = require("axios");

const router = express.Router();

//Holiday API GET
router.get("/:year", async (req, res) => {
  try {
    const { year } = req.params;

    if (!process.env.HOLIDAY_API_URL) {
      return res.status(500).json({
        error: "HOLIDAY_API_URL is not configured in .env",
      });
    }

    const response = await axios.get(
  `${process.env.HOLIDAY_API_URL}/api/v2/holidays`,
  {
    params: {
      api_key: process.env.HOLIDAY_API_KEY,
      country: "LK",
      year: year,
    },
  }
);
    res.json(response.data);

  } catch (error) {
    console.error("========== HOLIDAY ERROR ==========");
    console.error("Message:", error.message);
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    console.error("===================================");

    res.status(500).json({
      error: "Failed to fetch holidays",
    });
  }
});

module.exports = router;