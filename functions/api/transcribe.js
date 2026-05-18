import { transcribeAudio } from "../../lib/transcribe.js";

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 540000);

  try {
    const result = await transcribeAudio(body, {
      openAiApiKey: env.OPENAI_API_KEY,
      deepgramApiKey: env.DEEPGRAM_API_KEY,
      signal: controller.signal
    });
    return sendJson(result);
  } catch (error) {
    const status = Number(error.status || 502);
    const message = error.name === "AbortError" ? "音频转写超时" : error.message || "音频转写失败";
    return sendJson(
      {
        ok: false,
        error: message,
        setupRequired: Boolean(error.setupRequired),
        contentLength: error.contentLength,
        maxBytes: error.maxBytes,
        provider: error.provider
      },
      status
    );
  } finally {
    clearTimeout(timeout);
  }
}

function sendJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
