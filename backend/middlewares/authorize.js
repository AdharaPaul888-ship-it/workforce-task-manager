exports.authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.permissions) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const hasPermission = req.permissions.some(
      (perm) => perm === "*" || requiredPermissions.includes(perm)
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