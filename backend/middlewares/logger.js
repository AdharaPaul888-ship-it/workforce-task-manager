// middleware/logger.js
// A custom middleware: logs every incoming request, then calls next()
// to pass control along the chain. Forgetting next() means the request
// hangs forever — this is worth demonstrating live (comment it out once
// and show the request never completes).

function logger(req, res, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
}

module.exports = logger;