import {
  clearAuthCookie,
  createAuthCookie,
  getAuthPassword,
  isAuthorized,
  renderLoginPage,
  shouldReturnJson,
  unauthorizedJson
} from "../lib/auth.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const password = getAuthPassword(env);

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const formData = await request.formData().catch(() => new FormData());
    const nextUrl = safeNext(formData.get("next"));
    if (String(formData.get("password") || "") === password) {
      return redirect(nextUrl, {
        "Set-Cookie": await createAuthCookie(password, request.url)
      });
    }
    return redirect("/?auth=failed");
  }

  if (url.pathname === "/api/auth/logout") {
    return redirect("/", {
      "Set-Cookie": clearAuthCookie(request.url)
    });
  }

  if (await isAuthorized(request.headers.get("cookie"), password)) {
    return next();
  }

  if (shouldReturnJson(url.pathname)) {
    return new Response(unauthorizedJson(), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  return new Response(renderLoginPage({ error: url.searchParams.get("auth") === "failed", next: `${url.pathname}${url.search}` }), {
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
