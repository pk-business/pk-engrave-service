export default (config, { strapi }) => {
  const { interval, max } = config;
  
  // In-memory store for request counts
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  // Cleanup old entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requestCounts.entries()) {
      if (now > value.resetTime) {
        requestCounts.delete(key);
      }
    }
  }, 60000);

  return async (ctx, next) => {
    // Get client identifier (IP address)
    const identifier = ctx.request.ip || 
                      ctx.request.headers['x-forwarded-for'] || 
                      ctx.request.headers['x-real-ip'] ||
                      'unknown';

    const now = Date.now();
    const windowMs = interval.min * 60 * 1000; // Convert minutes to milliseconds
    
    // Get or create request count for this identifier
    let record = requestCounts.get(identifier);
    
    if (!record || now > record.resetTime) {
      // Create new record or reset if window expired
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      requestCounts.set(identifier, record);
    }

    // Increment request count
    record.count++;

    // Set rate limit headers
    ctx.set('X-RateLimit-Limit', max.toString());
    ctx.set('X-RateLimit-Remaining', Math.max(0, max - record.count).toString());
    ctx.set('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    // Check if limit exceeded
    if (record.count > max) {
      ctx.status = 429;
      ctx.body = {
        error: {
          status: 429,
          name: 'TooManyRequests',
          message: 'Too many requests, please try again later.',
          details: {
            limit: max,
            windowMs: windowMs,
            retryAfter: Math.ceil((record.resetTime - now) / 1000),
          },
        },
      };
      return;
    }

    await next();
  };
};
