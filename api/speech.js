
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Vercel."
    });
  }

  const { text, languageCode } = req.body || {};

  if (
    typeof text !== "string" ||
    !text.trim() ||
    text.length > 3000
  ) {
    return res.status(400).json({
      error: "Provide text between 1 and 3000 characters."
    });
  }

  const speechStyles = {
    "en-US":
      "Speak in natural American English with a warm, friendly voice, relaxed conversational pacing, authentic American pronunciation, and natural intonation.",
    "fr-FR":
      "Speak natural French as used in France, with authentic French pronunciation and conversational intonation.",
    "pt-BR":
      "Speak natural Brazilian Portuguese, with authentic Brazilian pronunciation and conversational intonation."
  };

  const speechStyle =
    speechStyles[languageCode] || speechStyles["en-US"];

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash-tts",
          input: [{
            type: "user_input",
            content: [{
              type: "text",
              text: text.trim(),
              annotations: [{
                type: "speech_metadata",
                style: speechStyle
              }]
            }]
          }],
          response_format: {
            type: "audio"
          },
          generation_config: {
            speech_config: [{
              voice: "Kore"
            }]
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        "Gemini TTS error:",
        response.status,
        data?.error?.message || "Request failed"
      );

      return res.status(response.status).json({
        error: data?.error?.message || "Audio generation failed."
      });
    }

    const audioPart = (data.steps || [])
      .filter(step => step.type === "model_output")
      .flatMap(step => step.content || [])
      .find(part => part.type === "audio" && part.data);

    if (!audioPart) {
      console.error("Gemini TTS returned no audio data.");

      return res.status(502).json({
        error: "Gemini did not return an audio file."
      });
    }

    return res.status(200).json({
      audio: audioPart.data,
      mimeType: "audio/wav"
    });

  } catch (error) {
    console.error("Speech endpoint error:", error);

    return res.status(502).json({
      error: "Unable to generate speech."
    });
  }
};
