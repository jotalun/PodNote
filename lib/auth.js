const authCookieName = "podnote_auth";
const defaultPassword = "123456";
const sessionSeconds = 7 * 24 * 60 * 60;

export function getAuthPassword(env = {}) {
  return String(env.PODNOTE_PASSWORD || defaultPassword);
}

export async function isAuthorized(cookieHeader, password) {
  const token = readCookie(cookieHeader, authCookieName);
  if (!token) return false;
  return verifySessionToken(token, password);
}

export async function createAuthCookie(password, requestUrl) {
  const token = await createSessionToken(password);
  return `${authCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionSeconds}${isSecureUrl(requestUrl) ? "; Secure" : ""}`;
}

export function clearAuthCookie(requestUrl) {
  return `${authCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecureUrl(requestUrl) ? "; Secure" : ""}`;
}

export function renderLoginPage(options = {}) {
  const error = options.error ? `<p class="error">密码不对，请再试一次。</p>` : "";
  const next = escapeHtml(options.next || "/");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PodNote 登录</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f5f7;
        --ink: #111111;
        --muted: #6e6e73;
        --line: rgba(0, 0, 0, 0.1);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #ffffff 0%, var(--bg) 100%);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
      }
      main {
        width: min(420px, calc(100% - 32px));
        border: 1px solid var(--line);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.82);
        padding: 28px;
        box-shadow: 0 22px 70px rgba(0, 0, 0, 0.08);
        backdrop-filter: blur(24px) saturate(1.2);
        -webkit-backdrop-filter: blur(24px) saturate(1.2);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 28px;
      }
      .mark {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 8px;
        background: #111111;
        color: white;
        font-weight: 800;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }
      form {
        display: grid;
        gap: 12px;
        margin-top: 24px;
      }
      input {
        width: 100%;
        height: 48px;
        border: 1px solid var(--line);
        border-radius: 8px;
        padding: 0 13px;
        background: white;
        color: var(--ink);
        font: inherit;
        outline: none;
      }
      input:focus {
        border-color: rgba(0, 0, 0, 0.22);
        box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.06);
      }
      button {
        height: 48px;
        border: 0;
        border-radius: 8px;
        background: #111111;
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      .error {
        margin-top: 14px;
        color: #b42318;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">
        <div class="mark">PN</div>
        <div>
          <strong>PodNote</strong>
          <p>Private preview</p>
        </div>
      </div>
      <h1>输入访问密码</h1>
      <p>这个版本还在搭建中，先用密码保护起来。</p>
      ${error}
      <form method="post" action="/api/auth/login">
        <input name="password" type="password" autocomplete="current-password" placeholder="访问密码" autofocus />
        <input name="next" type="hidden" value="${next}" />
        <button type="submit">进入 PodNote</button>
      </form>
    </main>
  </body>
</html>`;
}

export function unauthorizedJson() {
  return JSON.stringify({ error: "需要访问密码" });
}

export function shouldReturnJson(pathname) {
  return pathname.startsWith("/api/");
}

export function readCookie(cookieHeader, name) {
  const cookies = String(cookieHeader || "").split(";");
  for (const cookie of cookies) {
    const [rawKey, ...rawValue] = cookie.trim().split("=");
    if (rawKey === name) return rawValue.join("=");
  }
  return "";
}

async function createSessionToken(password) {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionSeconds;
  const signature = await sign(String(expiresAt), password);
  return `${expiresAt}.${signature}`;
}

async function verifySessionToken(token, password) {
  const [expiresAt, signature] = String(token || "").split(".");
  if (!expiresAt || !signature) return false;
  const expiresAtNumber = Number(expiresAt);
  if (!Number.isFinite(expiresAtNumber) || expiresAtNumber < Math.floor(Date.now() / 1000)) return false;
  const expected = await sign(expiresAt, password);
  return timingSafeEqual(signature, expected);
}

async function sign(value, password) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array(signature));
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function isSecureUrl(requestUrl) {
  try {
    return new URL(requestUrl).protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
