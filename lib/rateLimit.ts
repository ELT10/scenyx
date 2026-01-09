import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter
// For production with multiple instances, consider Redis or Upstash

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (entry.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60 * 1000 // 1 minute
): RateLimitResult {
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

/**
 * Get a rate limit identifier from the request.
 * Uses session cookie if available, falls back to IP address.
 */
export function getRateLimitIdentifier(req: NextRequest): string {
  // Try to get session cookie for authenticated users
  const sessionId = req.cookies.get('scenyx_session')?.value;
  if (sessionId) {
    return `session:${sessionId}`;
  }

  // Fall back to IP address for unauthenticated requests
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 
             'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limit configuration for different endpoints
 */
export const RATE_LIMITS = {
  // Auth endpoints - more restrictive
  auth: { maxRequests: 10, windowMs: 60 * 1000 },         // 10 per minute
  
  // Generation endpoints - moderate limits
  generate: { maxRequests: 20, windowMs: 60 * 1000 },     // 20 per minute
  
  // Check/status endpoints - more lenient
  status: { maxRequests: 60, windowMs: 60 * 1000 },       // 60 per minute
  
  // Payment endpoints - restrictive
  payment: { maxRequests: 10, windowMs: 60 * 1000 },      // 10 per minute
} as const;

/**
 * Apply rate limiting to an API route handler.
 * Returns a 429 response if rate limit is exceeded.
 */
export function withRateLimit<T>(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: { maxRequests: number; windowMs: number } = RATE_LIMITS.generate
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const identifier = getRateLimitIdentifier(req);
    const result = checkRateLimit(identifier, config.maxRequests, config.windowMs);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetAt),
          },
        }
      );
    }

    // Add rate limit headers to successful responses
    const response = await handler(req);
    
    // Clone response to add headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-RateLimit-Limit', String(config.maxRequests));
    newHeaders.set('X-RateLimit-Remaining', String(result.remaining));
    newHeaders.set('X-RateLimit-Reset', String(result.resetAt));

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}
