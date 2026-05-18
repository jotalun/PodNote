import {
  clearAuthCookie,
  createAuthCookie,
  getAuthorizedSession,
  getSessionSecret,
  renderLoginPage,
  shouldReturnJson,
  unauthorizedJson
} from "../lib/auth.js";
import { hasInviteConfiguration, redeemInvite } from "../lib/metering.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const secret = getSessionSecret(env);

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const formData = await request.formData().catch(() => new FormData());
    const nextUrl = safeNext(formData.get("next"));
    const user = await redeemInvite(formData.get("inviteCode") || formData.get("password"), env);
    if (user) {
      return redirect(nextUrl, {
        "Set-Cookie": await createAuthCookie(user, secret, request.url)
      });
    }
    return redirect("/?auth=failed");
  }

  if (url.pathname === "/api/auth/logout") {
    return redirect("/", {
      "Set-Cookie": clearAuthCookie(request.url)
    });
  }

  const session = await getAuthorizedSession(request.headers.get("cookie"), secret);
  if (session) {
    context.data = {
      ...(context.data || {}),
      auth: session
    };
    return next();
  }

  if (shouldReturnJson(url.pathname)) {
    return new Response(unauthorizedJson(), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  return new Response(renderLoginPage({ error: url.searchParams.get("auth") === "failed", setup: !hasInviteConfiguration(env), next: `${url.pathname}${url.search}` }), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function safeNext(value) {
  const next = String(value || "/");
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return "/";
  if (next.startsWith("/api/auth/")) return "/";
  return next;
}
