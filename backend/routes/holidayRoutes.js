const express = require("express");
const axios = require("axios");

const router = express.Router();

//Holiday API GET
router.get("/:year", async (req, res) => {
  try {
    const { year } = req.params;

    if (!process.env.HOLIDAY_API_URL) {
      return res.status(500).json({ error: "HOLIDAY_API_URL is not configured in .env" });
    }

    //validate year 
    const response = await axios.get(
      `${process.env.HOLIDAY_API_URL}/api/v1/holidays`,
      {
        params: {
          year,
          format: "full",
        },
        headers: {
          "X-API-Key": process.env.HOLIDAY_API_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "Holiday API Error:",
      error.response?.data || error.message
    );
    // Error message
    res.status(500).json({
      error: "Failed to fetch holidays",
    });
  }
});

module.exports = router;