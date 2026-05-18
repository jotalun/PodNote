import { transcribeAudio } from "../../lib/transcribe.js";
import { commitTranscribeUsage, getQuotaSnapshot, guardTranscribeQuota } from "../../lib/metering.js";
import { getAuthorizedSession, getSessionSecret } from "../../lib/auth.js";

export async function onRequestPost({ request, env, data }) {
  const body = await request.json().catch(() => ({}));
  const session = data?.auth || (await getAuthorizedSession(request.headers.get("cookie"), getSessionSecret(env)));
  if (!session) {
    return sendJson({ ok: false, error: "需要邀请码登录" }, 401);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 540000);

  try {
    const quotaGuard = await guardTranscribeQuota(env, session, body);
    if (quotaGuard.cached) {
      return sendJson(quotaGuard.cached);
    }

    const result = await transcribeAudio(body, {
      openAiApiKey: env.OPENAI_API_KEY,
      deepgramApiKey: env.DEEPGRAM_API_KEY,
      signal: controller.signal
    });
    const quota = await commitTranscribeUsage(env, session, body, result, quotaGuard);
    return sendJson({ ...result, quota });
  } catch (error) {
    const status = Number(error.status || 502);
    const message = error.name === "AbortError" ? "音频转写超时" : error.message || "音频转写失败";
    const quota = error.quota || (status === 429 ? await getQuotaSnapshot(env, session).catch(() => null) : null);
    return sendJson(
      {
        ok: false,
        error: message,
        setupRequired: Boolean(error.setupRequired),
        contentLength: error.contentLength,
        maxBytes: error.maxBytes,
        provider: error.provider,
        quota
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
