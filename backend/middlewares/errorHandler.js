// middleware/errorHandler.js
// Two separate middlewares:
//  1. notFound - catches any request that didn't match a route above it
//  2. errorHandler - the special 4-argument middleware Express recognizes
//     as an error handler. Must be registered LAST, after all routes.

function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server error",
  });
}

module.exports = { notFound, errorHandler };