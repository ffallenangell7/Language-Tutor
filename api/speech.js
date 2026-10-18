const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/interactions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      model: "gemini-3.8-flash-tts",
      input: [{
        type: "user_input",
        content: [{
          type: "text",
          text: text,
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
