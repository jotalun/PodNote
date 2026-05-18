import { resolvePodcastSource } from "../../lib/podcast-source.js";

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const feedUrl = String(url.searchParams.get("url") || "").trim();

  if (!feedUrl) {
    return sendJson({ error: "缺少播客链接" }, 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(feedUrl);
  } catch {
    return sendJson({ error: "播客链接格式不正确" }, 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return sendJson({ error: "播客链接必须是 http 或 https" }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const feed = await resolvePodcastSource(parsedUrl.toString(), { signal: controller.signal });
    return sendJson(feed);
  } catch (error) {
    const message = error.name === "AbortError" ? "链接解析超时" : error.message || "链接解析失败";
    return sendJson({ error: message }, 502);
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
