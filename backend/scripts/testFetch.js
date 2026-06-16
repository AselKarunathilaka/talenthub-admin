const fetch = require("node-fetch");
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });

fetch("https://talenttrail.slt.lk/api/stats/dashboard", { agent })
  .then((r) => console.log("✅ node-fetch with SSL bypass status:", r.status))
  .catch((err) => console.error("❌ Still failing:", err.message));
