const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No token, authorization denied",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret-key"
    );

    req.user = await User.findById(decoded.id).select("+role +tenant +permissions");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not found, authorization denied",
      });
    }

    req.tenantId = req.user.tenant;
    req.permissions =
      typeof req.user.getPermissions === "function"
        ? req.user.getPermissions()
        : [];

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Token expired or invalid",
    });
  }
};

exports.authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.permissions) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const hasPermission = req.permissions.some((perm) =>
      requiredPermissions.includes(perm)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this route",
      });
    }

    next();
  };
};

exports.tenantScope = (req, res, next) => {
  // Super Admin can override tenant via X-Tenant-Id header
  if (req.user.role === "Super Admin" && req.headers["x-tenant-id"]) {
    const Tenant = require("../models/Tenant");
    Tenant.findById(req.headers["x-tenant-id"]).then((tenant) => {
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: "Tenant not found",
        });
      }
      req.tenantId = req.headers["x-tenant-id"];
      next();
    }).catch(() =>
      res.status(500).json({
        success: false,
        message: "Error checking tenant",
      })
    );
  } else {
    next();
  }
};