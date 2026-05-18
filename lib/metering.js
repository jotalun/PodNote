import { estimateCost, parseDurationToSeconds } from "./transcribe.js";

const memoryStore = new Map();
const defaultPlan = "free";
const planLimitDefaults = {
  free: {
    monthlyTranscribeMinutes: 60,
    dailyTranscribeMinutes: 120,
    maxSingleTranscribeMinutes: 120,
    monthlyAnalyzeCount: 30
  },
  owner: {
    monthlyTranscribeMinutes: 3000,
    dailyTranscribeMinutes: 600,
    maxSingleTranscribeMinutes: 240,
    monthlyAnalyzeCount: 1000
  }
};

export async function redeemInvite(inviteCode, env = {}) {
  const normalized = normalizeInviteCode(inviteCode);
  if (!normalized) return null;

  const inviteHash = await hashText(normalized);
  const invite =
    (await readJson(env, `invite:${inviteHash}`)) ||
    (await readJson(env, `invite-code:${normalized}`)) ||
    findConfiguredInvite(normalized, env);

  if (!invite || invite.status === "revoked" || invite.status === "disabled") return null;

  const userId = invite.userId || `user_${inviteHash.slice(0, 12)}`;
  const plan = invite.plan || env.PODNOTE_DEFAULT_PLAN || defaultPlan;
  const label = invite.label || invite.name || `内测用户 ${inviteHash.slice(0, 6)}`;
  const now = new Date().toISOString();
  await writeJson(env, `invite:${inviteHash}`, {
    ...invite,
    userId,
    plan,
    label,
    status: invite.status || "active",
    firstUsedAt: invite.firstUsedAt || now,
    lastUsedAt: now
  });

  const user = await ensureUser(env, {
    userId,
    inviteHash,
    plan,
    label
  });

  return user;
}

export function hasInviteConfiguration(env = {}) {
  return Boolean(String(env.PODNOTE_INVITE_CODES || "").trim() || getKvBinding(env));
}

export function getConfigSnapshot(env = {}) {
  const limits = getPlanLimits(env, env.PODNOTE_DEFAULT_PLAN || defaultPlan);
  const inviteCodesConfigured = Boolean(String(env.PODNOTE_INVITE_CODES || "").trim());
  const kvBound = Boolean(getKvBinding(env));
  const temporaryInviteEnabled = !inviteCodesConfigured && !kvBound;
  const budgetConfigured = Boolean(String(env.PODNOTE_GLOBAL_DAILY_COST_USD || "").trim());
  const checks = [
    {
      id: "invite",
      label: "邀请码",
      status: inviteCodesConfigured || temporaryInviteEnabled ? "ok" : "warning",
      detail: temporaryInviteEnabled
        ? "当前可用临时内测码 123456；公开前请配置正式邀请码。"
        : inviteCodesConfigured
          ? "已配置正式邀请码。"
          : "已绑定 KV，但请确认 KV 里已经写入邀请码；否则用户无法登录。"
    },
    {
      id: "session",
      label: "登录安全",
      status: env.PODNOTE_SESSION_SECRET ? "ok" : "warning",
      detail: env.PODNOTE_SESSION_SECRET ? "已配置独立登录签名密钥。" : "未配置登录签名密钥，当前使用临时默认值。"
    },
    {
      id: "kv",
      label: "Cloudflare KV",
      status: kvBound ? "ok" : "warning",
      detail: kvBound ? "已绑定，用户额度和 transcript 缓存可持久保存。" : "未绑定，线上额度和缓存无法长期持久化。"
    },
    {
      id: "deepseek",
      label: "DeepSeek 分析",
      status: env.DEEPSEEK_API_KEY ? "ok" : "missing",
      detail: env.DEEPSEEK_API_KEY ? "已配置。" : "未配置，无法生成 Markdown 知识笔记。"
    },
    {
      id: "openai",
      label: "OpenAI 短音频转写",
      status: env.OPENAI_API_KEY ? "ok" : "warning",
      detail: env.OPENAI_API_KEY ? "已配置。" : "未配置，25MB 以下音频无法用 OpenAI 转写。"
    },
    {
      id: "deepgram",
      label: "Deepgram 长音频转写",
      status: env.DEEPGRAM_API_KEY ? "ok" : "warning",
      detail: env.DEEPGRAM_API_KEY ? "已配置。" : "未配置，长音频无法用 Deepgram URL 转写。"
    },
    {
      id: "budget",
      label: "每日总预算",
      status: budgetConfigured && limits.globalDailyCostUsd > 0 ? "ok" : "warning",
      detail: budgetConfigured && limits.globalDailyCostUsd > 0 ? `当前上限 $${limits.globalDailyCostUsd}/天。` : `未显式设置，当前使用默认 $${limits.globalDailyCostUsd}/天。公开前建议按预算设置。`
    }
  ];

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    checks,
    auth: {
      inviteCodesConfigured,
      temporaryInviteEnabled,
      sessionSecretConfigured: Boolean(env.PODNOTE_SESSION_SECRET)
    },
    storage: {
      kvBound,
      persistent: kvBound
    },
    apis: {
      deepseek: Boolean(env.DEEPSEEK_API_KEY),
      openai: Boolean(env.OPENAI_API_KEY),
      deepgram: Boolean(env.DEEPGRAM_API_KEY)
    },
    limits
  };
}

export async function getQuotaSnapshot(env = {}, session = {}) {
  const user = await ensureUser(env, session);
  const limits = getPlanLimits(env, user.plan);
  const monthUsage = await readJson(env, monthlyUsageKey(user.userId)) || {};
  const dayUsage = await readJson(env, dailyUsageKey(user.userId)) || {};
  const globalDayUsage = await readJson(env, globalDailyUsageKey()) || {};

  const usage = {
    monthlyTranscribeMinutes: Number(monthUsage.transcribeMinutes || 0),
    dailyTranscribeMinutes: Number(dayUsage.transcribeMinutes || 0),
    monthlyAnalyzeCount: Number(monthUsage.analyzeCount || 0),
    globalDailyTranscribeMinutes: Number(globalDayUsage.transcribeMinutes || 0),
    globalDailyCostUsd: Number(globalDayUsage.estimatedCostUsd || 0)
  };

  return {
    user: publicUser(user),
    limits,
    usage,
    remaining: {
      monthlyTranscribeMinutes: remaining(limits.monthlyTranscribeMinutes, usage.monthlyTranscribeMinutes),
      dailyTranscribeMinutes: remaining(limits.dailyTranscribeMinutes, usage.dailyTranscribeMinutes),
      monthlyAnalyzeCount: remaining(limits.monthlyAnalyzeCount, usage.monthlyAnalyzeCount),
      globalDailyTranscribeMinutes: remaining(limits.globalDailyTranscribeMinutes, usage.globalDailyTranscribeMinutes),
      globalDailyCostUsd: remaining(limits.globalDailyCostUsd, usage.globalDailyCostUsd)
    }
  };
}

export async function guardAnalyzeQuota(env = {}, session = {}) {
  const snapshot = await getQuotaSnapshot(env, session);
  const limit = Number(snapshot.limits.monthlyAnalyzeCount || 0);
  if (limit > 0 && snapshot.usage.monthlyAnalyzeCount + 1 > limit) {
    throw quotaError(`本月 DeepSeek 分析额度已用完。当前上限 ${limit} 次。`, { quota: snapshot });
  }
  return snapshot;
}

export async function commitAnalyzeUsage(env = {}, session = {}) {
  const user = await ensureUser(env, session);
  await addUsage(env, monthlyUsageKey(user.userId), {
    analyzeCount: 1,
    lastAnalyzeAt: new Date().toISOString()
  });
  return getQuotaSnapshot(env, user);
}

export async function guardTranscribeQuota(env = {}, session = {}, input = {}) {
  const user = await ensureUser(env, session);
  const cacheKey = await transcriptCacheKey(input);
  const cached = await readJson(env, cacheKey);
  if (cached?.transcript) {
    return {
      cached: {
        ok: true,
        ...cached,
        sourceType: cached.sourceType || "server-cache-transcript",
        provider: cached.provider || "cache",
        cached: true,
        quota: await getQuotaSnapshot(env, user)
      },
      cacheKey
    };
  }

  const snapshot = await getQuotaSnapshot(env, user);
  const durationMinutes = estimateDurationMinutes(input.duration);
  const estimatedCostUsd = estimateTranscribeCost(input);
  const limits = snapshot.limits;

  if (limits.maxSingleTranscribeMinutes > 0 && durationMinutes > limits.maxSingleTranscribeMinutes) {
    throw quotaError(`这集约 ${durationMinutes} 分钟，超过当前邀请码单集上限 ${limits.maxSingleTranscribeMinutes} 分钟。`, { quota: snapshot });
  }

  if (limits.dailyTranscribeMinutes > 0 && snapshot.usage.dailyTranscribeMinutes + durationMinutes > limits.dailyTranscribeMinutes) {
    throw quotaError(`今天剩余转写额度不足。这集约 ${durationMinutes} 分钟，今日还剩 ${snapshot.remaining.dailyTranscribeMinutes} 分钟。`, { quota: snapshot });
  }

  if (limits.monthlyTranscribeMinutes > 0 && snapshot.usage.monthlyTranscribeMinutes + durationMinutes > limits.monthlyTranscribeMinutes) {
    throw quotaError(`本月剩余转写额度不足。这集约 ${durationMinutes} 分钟，本月还剩 ${snapshot.remaining.monthlyTranscribeMinutes} 分钟。`, { quota: snapshot });
  }

  if (limits.globalDailyTranscribeMinutes > 0 && snapshot.usage.globalDailyTranscribeMinutes + durationMinutes > limits.globalDailyTranscribeMinutes) {
    throw quotaError("今天全站转写额度已用完，为了控制成本，今天先暂停生成 transcript。", { quota: snapshot });
  }

  if (limits.globalDailyCostUsd > 0 && snapshot.usage.globalDailyCostUsd + estimatedCostUsd > limits.globalDailyCostUsd) {
    throw quotaError(`今天全站预算已用完。预计本次约 $${estimatedCostUsd.toFixed(2)}，今日预算上限 $${limits.globalDailyCostUsd.toFixed(2)}。`, { quota: snapshot });
  }

  return {
    cacheKey,
    user,
    estimatedMinutes: durationMinutes,
    estimatedCostUsd,
    quota: snapshot
  };
}

export async function commitTranscribeUsage(env = {}, session = {}, input = {}, result = {}, guard = {}) {
  const user = await ensureUser(env, session);
  const durationMinutes = actualDurationMinutes(input, result, guard);
  const now = new Date().toISOString();
  const provider = result.provider || input.provider || "unknown";
  const estimatedCostUsd = estimateTranscribeCost(input, result, provider);

  await addUsage(env, monthlyUsageKey(user.userId), {
    transcribeMinutes: durationMinutes,
    estimatedCostUsd,
    lastTranscribeAt: now
  });
  await addUsage(env, dailyUsageKey(user.userId), {
    transcribeMinutes: durationMinutes,
    estimatedCostUsd,
    lastTranscribeAt: now
  });
  await addUsage(env, globalDailyUsageKey(), {
    transcribeMinutes: durationMinutes,
    estimatedCostUsd,
    lastTranscribeAt: now
  });

  if (result.transcript && guard.cacheKey) {
    await writeJson(env, guard.cacheKey, {
      transcript: result.transcript,
      provider,
      sourceType: result.sourceType || "server-cache-transcript",
      model: result.model || "",
      language: result.language || "",
      audioBytes: result.audioBytes || input.audioBytes || 0,
      durationSeconds: result.durationSeconds || parseDurationToSeconds(input.duration),
      savedAt: now
    });
  }

  return getQuotaSnapshot(env, user);
}

export function quotaError(message, details = {}) {
  const error = new Error(message);
  error.status = 429;
  error.quota = details.quota;
  return error;
}

function getPlanLimits(env = {}, plan = defaultPlan) {
  const normalizedPlan = String(plan || defaultPlan).toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const defaults = defaultLimitsForPlan(plan);
  return {
    monthlyTranscribeMinutes: readLimit(env, `PODNOTE_${normalizedPlan}_MONTHLY_TRANSCRIBE_MINUTES`, readLimit(env, "PODNOTE_MONTHLY_TRANSCRIBE_MINUTES", defaults.monthlyTranscribeMinutes)),
    dailyTranscribeMinutes: readLimit(env, `PODNOTE_${normalizedPlan}_DAILY_TRANSCRIBE_MINUTES`, readLimit(env, "PODNOTE_DAILY_TRANSCRIBE_MINUTES", defaults.dailyTranscribeMinutes)),
    maxSingleTranscribeMinutes: readLimit(env, `PODNOTE_${normalizedPlan}_MAX_SINGLE_TRANSCRIBE_MINUTES`, readLimit(env, "PODNOTE_MAX_SINGLE_TRANSCRIBE_MINUTES", defaults.maxSingleTranscribeMinutes)),
    monthlyAnalyzeCount: readLimit(env, `PODNOTE_${normalizedPlan}_MONTHLY_ANALYZE_COUNT`, readLimit(env, "PODNOTE_MONTHLY_ANALYZE_COUNT", defaults.monthlyAnalyzeCount)),
    globalDailyTranscribeMinutes: readLimit(env, "PODNOTE_GLOBAL_DAILY_TRANSCRIBE_MINUTES", 1000),
    globalDailyCostUsd: readLimit(env, "PODNOTE_GLOBAL_DAILY_COST_USD", 20)
  };
}

function defaultLimitsForPlan(plan) {
  return planLimitDefaults[String(plan || defaultPlan).toLowerCase()] || planLimitDefaults.free;
}

async function ensureUser(env, session = {}) {
  const userId = String(session.userId || "").trim();
  if (!userId) throw quotaError("当前登录信息无效，请重新使用邀请码登录。");

  const key = `user:${userId}`;
  const existing = await readJson(env, key);
  const user = {
    userId,
    inviteHash: session.inviteHash || existing?.inviteHash || "",
    plan: session.plan || existing?.plan || defaultPlan,
    label: session.label || existing?.label || "内测用户",
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await writeJson(env, key, user);
  return user;
}

function publicUser(user) {
  return {
    id: user.userId,
    label: user.label,
    plan: user.plan
  };
}

function findConfiguredInvite(normalizedCode, env = {}) {
  const raw = String(env.PODNOTE_INVITE_CODES || "").trim();
  if (!raw && !getKvBinding(env) && normalizedCode === "123456") {
    return {
      status: "active",
      label: "临时内测用户",
      plan: env.PODNOTE_DEFAULT_PLAN || defaultPlan,
      source: "bootstrap"
    };
  }

  if (!raw) return null;

  for (const entry of raw.split(/[\n,]+/)) {
    const [code, label, plan] = entry.split("|").map((part) => part.trim());
    if (normalizeInviteCode(code) === normalizedCode) {
      return {
        status: "active",
        label,
        plan: plan || env.PODNOTE_DEFAULT_PLAN || defaultPlan,
        source: "env"
      };
    }
  }

  return null;
}

function normalizeInviteCode(value) {
  return String(value || "").trim().toLowerCase();
}

function estimateDurationMinutes(duration) {
  const seconds = parseDurationToSeconds(duration);
  return Math.max(1, Math.ceil(seconds / 60) || 1);
}

function actualDurationMinutes(input, result, guard) {
  const seconds = Number(result.durationSeconds || 0) || parseDurationToSeconds(input.duration);
  return Math.max(guard.estimatedMinutes || 1, Math.ceil(seconds / 60) || 1);
}

function estimateTranscribeCost(input = {}, result = {}, provider = input.provider || "openai") {
  return estimateCost(input.duration || result.durationSeconds, provider) || 0;
}

async function transcriptCacheKey(input = {}) {
  const raw = `${input.audioUrl || ""}|${input.title || ""}|${input.duration || ""}`;
  return `transcript-cache:${await hashText(raw)}`;
}

async function addUsage(env, key, increments = {}) {
  const current = (await readJson(env, key)) || {};
  const next = {
    ...current,
    transcribeMinutes: Number(current.transcribeMinutes || 0) + Number(increments.transcribeMinutes || 0),
    analyzeCount: Number(current.analyzeCount || 0) + Number(increments.analyzeCount || 0),
    estimatedCostUsd: Number((Number(current.estimatedCostUsd || 0) + Number(increments.estimatedCostUsd || 0)).toFixed(4)),
    updatedAt: new Date().toISOString()
  };
  if (increments.lastTranscribeAt) next.lastTranscribeAt = increments.lastTranscribeAt;
  if (increments.lastAnalyzeAt) next.lastAnalyzeAt = increments.lastAnalyzeAt;
  await writeJson(env, key, next);
  return next;
}

function monthlyUsageKey(userId) {
  return `usage:${userId}:${new Date().toISOString().slice(0, 7)}`;
}

function dailyUsageKey(userId) {
  return `usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
}

function globalDailyUsageKey() {
  return `usage:global:${new Date().toISOString().slice(0, 10)}`;
}

function remaining(limit, used) {
  const numericLimit = Number(limit || 0);
  if (numericLimit <= 0) return null;
  return Math.max(0, numericLimit - Number(used || 0));
}

function readLimit(env, key, fallback) {
  const value = Number(env[key]);
  return Number.isFinite(value) ? value : fallback;
}

async function readJson(env, key) {
  const binding = getKvBinding(env);
  if (binding?.get) {
    const value = await binding.get(key);
    return value ? safeJson(value) : null;
  }
  return memoryStore.get(key) || null;
}

async function writeJson(env, key, value) {
  const binding = getKvBinding(env);
  if (binding?.put) {
    await binding.put(key, JSON.stringify(value));
    return;
  }
  memoryStore.set(key, value);
}

function getKvBinding(env = {}) {
  return env.PODNOTE_KV || env.PodNoteKV || env.KV || null;
}

function safeJson(value) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

async function hashText(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
