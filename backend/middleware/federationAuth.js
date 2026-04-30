const federationAuth = (req, res, next) => {
  const serviceToken = req.headers["x-service-token"];

  if (!serviceToken) {
    return res.status(403).json({
      error: "MISSING_SERVICE_TOKEN",
      message: "Missing X-Service-Token header",
    });
  }

  if (serviceToken !== process.env.TALENTHUB_FEDERATION_SECRET) {
    return res.status(403).json({
      error: "INVALID_SERVICE_TOKEN",
      message: "Invalid or missing service token",
    });
  }

  next();
};

module.exports = federationAuth;
