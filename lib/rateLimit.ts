// Simple in-memory rate limiter
// For production, consider Redis or a more robust solution

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000 // 1 minute
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + windowMs;
    rateLimitMap.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment counter
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

