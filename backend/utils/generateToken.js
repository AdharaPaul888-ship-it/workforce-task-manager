const jwt = require("jsonwebtoken");

const generateToken = (id, role, tenantId) => {
  return jwt.sign({ id, role, tenantId }, process.env.JWT_SECRET || "secret-key", {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  });
};

module.exports = generateToken;