const openAiTranscriptionEndpoint = "https://api.openai.com/v1/audio/transcriptions";
const maxOpenAiAudioBytes = 24 * 1024 * 1024;
const defaultTranscribeModel = "gpt-4o-mini-transcribe";
const transcribeCostPerMinuteUsd = 0.003;

export async function transcribeAudio(input, options = {}) {
  const apiKey = String(options.apiKey || "").trim();
  if (!apiKey) {
    throw userError("缺少 OPENAI_API_KEY。请先在 Cloudflare 环境变量里配置 OpenAI API Key。", 400, {
      setupRequired: true
    });
  }

  const audioUrl = normalizeHttpUrl(input.audioUrl);
  if (!audioUrl) {
    throw userError("缺少有效音频地址。请先导入带音频的播客单集。", 400);
  }

  const model = input.model || defaultTranscribeModel;
  const metadata = await inspectAudio(audioUrl, options.signal);
  if (metadata.contentLength > maxOpenAiAudioBytes) {
    throw userError("这期音频超过 25MB，OpenAI 文件转写接口不能一次上传。需要先做音频切片，或改接支持 URL 转写的服务。", 413, {
      contentLength: metadata.contentLength,
      maxBytes: maxOpenAiAudioBytes
    });
  }

  const audio = await downloadAudio(audioUrl, options.signal);
  const formData = new FormData();
  const blob = new Blob([audio.bytes], { type: audio.contentType || metadata.contentType || "audio/mpeg" });
  formData.append("file", blob, buildFileName(audioUrl, audio.contentType || metadata.contentType));
  formData.append("model", model);
  formData.append("response_format", "json");

  const upstream = await fetch(openAiTranscriptionEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData,
    signal: options.signal
  });

  const responseText = await upstream.text();
  if (!upstream.ok) {
    throw userError(parseOpenAiError(responseText) || `OpenAI 转写失败：HTTP ${upstream.status}`, upstream.status);
  }

  const data = safeJson(responseText);
  const transcript = String(data.text || responseText || "").trim();
  if (!transcript) {
    throw userError("OpenAI 没有返回可用 transcript。", 502);
  }

  return {
    ok: true,
    sourceType: "openai-transcribe",
    model,
    transcript,
    audioBytes: audio.bytes.byteLength,
    estimatedCostUsd: estimateCost(input.duration)
  };
}

export function estimateCost(duration) {
  const seconds = parseDurationToSeconds(duration);
  if (!seconds) return null;
  return Number(((seconds / 60) * transcribeCostPerMinuteUsd).toFixed(4));
}

export function parseDurationToSeconds(value) {
  if (!value) return 0;
  if (/^\d+$/.test(String(value))) return Number(value);
  const parts = String(value)
    .trim()
    .split(":")
    .map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

async function inspectAudio(audioUrl, signal) {
  try {
    const response = await fetch(audioUrl, {
      method: "HEAD",
      headers: { "User-Agent": "PodNote/0.10.0" },
      signal
    });
    if (!response.ok) return { contentLength: 0, contentType: "" };
    return {
      contentLength: Number(response.headers.get("content-length") || 0),
      contentType: response.headers.get("content-type") || ""
    };
  } catch {
    return { contentLength: 0, contentType: "" };
  }
}

async function downloadAudio(audioUrl, signal) {
  const response = await fetch(audioUrl, {
    headers: {
      Accept: "audio/mpeg, audio/mp4, audio/wav, audio/webm, audio/*, */*",
      "User-Agent": "PodNote/0.10.0"
    },
    signal
  });

  if (!response.ok) {
    throw userError(`音频下载失败：HTTP ${response.status}`, response.status);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxOpenAiAudioBytes) {
    throw userError("这期音频超过 25MB，OpenAI 文件转写接口不能一次上传。需要先做音频切片，或改接支持 URL 转写的服务。", 413, {
      contentLength,
      maxBytes: maxOpenAiAudioBytes
    });
  }

  const bytes = await readResponseBytes(response);
  return {
    bytes,
    contentType: response.headers.get("content-type") || ""
  };
}

async function readResponseBytes(response) {
  if (!response.body?.getReader) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxOpenAiAudioBytes) throwAudioTooLarge(buffer.byteLength);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxOpenAiAudioBytes) {
      try {
        await reader.cancel();
      } catch {
        // The response may already be closed.
      }
      throwAudioTooLarge(received);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function throwAudioTooLarge(contentLength) {
  throw userError("这期音频超过 25MB，OpenAI 文件转写接口不能一次上传。需要先做音频切片，或改接支持 URL 转写的服务。", 413, {
    contentLength,
    maxBytes: maxOpenAiAudioBytes
  });
}

function buildFileName(audioUrl, contentType = "") {
  try {
    const pathName = new URL(audioUrl).pathname;
    const name = pathName.split("/").filter(Boolean).pop() || "podcast-audio";
    if (/\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i.test(name)) return sanitizeFileName(name);
    return `${sanitizeFileName(name)}.${extensionForType(contentType)}`;
  } catch {
    return `podcast-audio.${extensionForType(contentType)}`;
  }
}

function extensionForType(contentType = "") {
  const lower = contentType.toLowerCase();
  if (lower.includes("mp4")) return "mp4";
  if (lower.includes("mpeg")) return "mp3";
  if (lower.includes("mpga")) return "mpga";
  if (lower.includes("m4a")) return "m4a";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("webm")) return "webm";
  return "mp3";
}

function sanitizeFileName(value) {
  return String(value || "podcast-audio").replace(/[\\/:*?"<>|]/g, "-").slice(0, 120) || "podcast-audio";
}

function normalizeHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function parseOpenAiError(text) {
  const data = safeJson(text);
  return data?.error?.message || "";
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function userError(message, status = 500, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}
