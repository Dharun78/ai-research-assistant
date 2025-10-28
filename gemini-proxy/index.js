export default {
  async fetch(request, env) {
    try {
      const { prompt, model, stream, config } = await request.json();

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing GEMINI_API_KEY in environment");

      // Forward the request to Gemini
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          ...config,
        }),
      });

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

      return new Response(JSON.stringify({ text }), {
        headers: { "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  },
};
