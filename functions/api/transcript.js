import { findTranscript } from "../../lib/transcript.js";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const result = await findTranscript(
      {
        feedUrl: url.searchParams.get("feedUrl"),
        episodeUrl: url.searchParams.get("episodeUrl"),
        audioUrl: url.searchParams.get("audioUrl"),
        transcriptUrl: url.searchParams.get("transcriptUrl"),
        title: url.searchParams.get("title")
      },
      { signal: controller.signal }
    );

    return sendJson(result, result.ok ? 200 : 404);
  } catch (error) {
    const message = error.name === "AbortError" ? "transcript 查找超时" : error.message || "transcript 查找失败";
    return sendJson({ ok: false, error: message }, 502);
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
