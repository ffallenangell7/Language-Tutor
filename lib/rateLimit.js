
const crypto = require("crypto");

const RATE_LIMIT_SCRIPT = `
local count = redis.call("INCR", KEYS[1])

if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end

local ttl = redis.call("PTTL", KEYS[1])

return {count, ttl}
`;

async function enforceRateLimit(
  req,
  res,
  { scope, limit, windowMs = 60000 }
) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    res.status(503).json({
      error: {
        message: "Rate limiter is not configured."
      }
    });
    return false;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  const rawIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;

  const ip = String(
    rawIp || req.socket?.remoteAddress || ""
  ).split(",")[0].trim();

  if (!ip) {
    res.status(503).json({
      error: {
        message: "Unable to identify request source."
      }
    });
    return false;
  }

  const ipHash = crypto
    .createHash("sha256")
    .update(ip)
    .digest("hex")
    .slice(0, 24);

  const key = `vocalis:rate:${scope}:${ipHash}`;

  try {
    const response = await fetch(
      redisUrl.replace(/\/+$/, ""),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([
          "EVAL",
          RATE_LIMIT_SCRIPT,
          1,
          key,
          windowMs
        ])
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data.error || "Upstash rate-limit request failed."
      );
    }

    const count = Number(data.result?.[0]);
    const ttlMs = Number(data.result?.[1]);

    if (
      !Number.isFinite(count) ||
      !Number.isFinite(ttlMs)
    ) {
      throw new Error("Invalid rate-limit response.");
    }

    if (count > limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil(ttlMs / 1000)
      );

      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("Cache-Control", "no-store");

      res.status(429).json({
        error: {
          message:
            `Too many requests. Please wait ${retryAfter} seconds and try again.`
        }
      });

      return false;
    }

    return true;

  } catch (error) {
    console.error(
      "Rate limiter error:",
      error.message
    );

    res.status(503).json({
      error: {
        message:
          "Request protection is temporarily unavailable. Please try again shortly."
      }
    });

    return false;
  }
}

module.exports = { enforceRateLimit };

