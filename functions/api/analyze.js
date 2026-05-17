const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const apiKey = env.DEEPSEEK_API_KEY || body.apiKey;

    if (!apiKey) {
      return sendJson({ error: "缺少 DeepSeek API Key" }, 400);
    }

    const upstream = await fetch(deepSeekEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: body.model || "deepseek-v4-flash",
        messages: body.messages,
        thinking: { type: "disabled" },
        stream: false
      })
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    return sendJson({ error: "DeepSeek 分析失败" }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

function sendJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
