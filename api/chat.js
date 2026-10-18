
const { enforceRateLimit } = require("../lib/rateLimit");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: { message: "Method not allowed." }
    });
  }

  const allowed = await enforceRateLimit(req, res, {
    scope: "chat",
    limit: 20,
    windowMs: 60_000
  });

  if (!allowed) return;
  
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: {
        message: "GEMINI_API_KEY is missing in Vercel."
      }
    });
  }

  const { contents, systemInstruction } = req.body || {};

  if (!Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({
      error: { message: "Conversation contents are required." }
    });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents,
          system_instruction: systemInstruction
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        response.status,
        data?.error?.message || data
      );

      return res.status(response.status).json({
        error: {
          message:
            data?.error?.message || "Gemini request failed."
        }
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Gemini connection error:", error);

    return res.status(502).json({
      error: { message: "Unable to reach Gemini API." }
    });
  }
};
