const errorHandler = (err, req, res, _next) => {
  console.error({
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    error: err.message,
    stack: err.stack,
  })

  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    success: false,
    message: err.statusCode ? err.message : 'Internal server error',
  })
}

export default errorHandler
