export function errorMiddleware(error, _request, response, _next) {
  const status = Number(error.status) || 500;
  response.status(status).json({
    error: status === 500 ? "Internal server error" : error.message,
  });
}
