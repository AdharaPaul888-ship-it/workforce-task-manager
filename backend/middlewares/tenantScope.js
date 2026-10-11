const Tenant = require("../models/Tenant");

exports.tenantScope = async (req, res, next) => {
  // Super Admin can override tenant via X-Tenant-Id header
  if (req.user.role === "Super Admin" && req.headers["x-tenant-id"]) {
    const tenant = await Tenant.findById(req.headers["x-tenant-id"]);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }
    req.tenantId = req.headers["x-tenant-id"];
  } else {
    req.tenantId = req.user.tenant;
  }
  next();
};