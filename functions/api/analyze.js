import { getAuthorizedSession, getSessionSecret } from "../../lib/auth.js";
import { commitAnalyzeUsage, getQuotaSnapshot, guardAnalyzeQuota } from "../../lib/metering.js";

const deepSeekEndpoint = "https://api.deepseek.com/chat/completions";

export async function onRequestPost({ request, env, data }) {
  try {
    const body = await request.json();
    const apiKey = env.DEEPSEEK_API_KEY || body.apiKey;
    const session = data?.auth || (await getAuthorizedSession(request.headers.get("cookie"), getSessionSecret(env)));

    if (!session) {
      return sendJson({ error: "需要邀请码登录" }, 401);
    }

    if (!apiKey) {
      return sendJson({ error: "缺少 DeepSeek API Key" }, 400);
    }

    await guardAnalyzeQuota(env, session);

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
    if (!upstream.ok) {
      return new Response(text, {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
        }
      });
    }

    const quota = await commitAnalyzeUsage(env, session);
    const payload = safeJson(text);
    if (payload && typeof payload === "object") {
      payload.quota = quota;
      return sendJson(payload, upstream.status);
    }

    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    const status = Number(error.status || 500);
    const quota = error.quota || (status === 429 ? await getQuotaSnapshot(env, data?.auth || {}).catch(() => null) : null);
    return sendJson({ error: error.message || "DeepSeek 分析失败", quota }, status);
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

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
