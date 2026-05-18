import { getAuthorizedSession, getSessionSecret } from "../../lib/auth.js";
import { getQuotaSnapshot } from "../../lib/metering.js";

export async function onRequestGet({ request, env, data }) {
  const session = data?.auth || (await getAuthorizedSession(request.headers.get("cookie"), getSessionSecret(env)));
  if (!session) {
    return sendJson({ error: "需要邀请码登录" }, 401);
  }

  const quota = await getQuotaSnapshot(env, session);
  return sendJson({ ok: true, user: quota.user, quota });
}

function sendJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
