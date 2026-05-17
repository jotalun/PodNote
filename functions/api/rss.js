const maxFeedBytes = 5 * 1024 * 1024;

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const feedUrl = String(url.searchParams.get("url") || "").trim();

  if (!feedUrl) {
    return sendJson({ error: "缺少 RSS 地址" }, 400);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(feedUrl);
  } catch {
    return sendJson({ error: "RSS 地址格式不正确" }, 400);
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return sendJson({ error: "RSS 地址必须是 http 或 https" }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "PodNote/0.5.0"
      },
      signal: controller.signal
    });

    if (!upstream.ok) {
      return sendJson({ error: `RSS 抓取失败：HTTP ${upstream.status}` }, upstream.status);
    }

    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > maxFeedBytes) {
      return sendJson({ error: "RSS 文件过大" }, 413);
    }

    const xml = await upstream.text();
    if (new TextEncoder().encode(xml).byteLength > maxFeedBytes) {
      return sendJson({ error: "RSS 文件过大" }, 413);
    }

    return sendJson({
      ok: true,
      url: upstream.url,
      xml
    });
  } catch (error) {
    const message = error.name === "AbortError" ? "RSS 抓取超时" : "RSS 抓取失败";
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
