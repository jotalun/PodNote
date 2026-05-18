const openAiTranscriptionEndpoint = "https://api.openai.com/v1/audio/transcriptions";
const deepgramTranscriptionEndpoint = "https://api.deepgram.com/v1/listen";
const maxOpenAiAudioBytes = 24 * 1024 * 1024;
const defaultTranscribeModel = "gpt-4o-mini-transcribe";
const defaultDeepgramModel = "nova-3";
const openAiCostPerMinuteUsd = 0.003;
const deepgramCostPerMinuteUsd = 0.0043;

export async function transcribeAudio(input, options = {}) {
  const audioUrl = normalizeHttpUrl(input.audioUrl);
  if (!audioUrl) {
    throw userError("缺少有效音频地址。请先导入带音频的播客单集。", 400);
  }

  const metadata = await inspectAudio(audioUrl, options.signal);
  const audioBytes = Number(input.audioBytes || metadata.contentLength || 0);
  const provider = chooseProvider(input.provider, audioBytes);

  if (provider === "deepgram") {
    return transcribeWithDeepgram(input, {
      apiKey: options.deepgramApiKey,
      audioUrl,
      audioBytes,
      signal: options.signal
    });
  }

  return transcribeWithOpenAi(input, {
    apiKey: options.openAiApiKey || options.apiKey,
    audioUrl,
    metadata,
    signal: options.signal
  });
}

async function transcribeWithOpenAi(input, options = {}) {
  const apiKey = String(options.apiKey || "").trim();
  if (!apiKey) {
    throw userError("缺少 OPENAI_API_KEY。请先在 Cloudflare 环境变量里配置 OpenAI API Key。", 400, {
      setupRequired: true,
      provider: "openai"
    });
  }

  if (options.metadata.contentLength > maxOpenAiAudioBytes) {
    throwAudioTooLarge(options.metadata.contentLength);
  }

  const model = input.model || defaultTranscribeModel;
  const audioUrl = options.audioUrl;
  const metadata = options.metadata;
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
    provider: "openai",
    model,
    transcript,
    audioBytes: audio.bytes.byteLength,
    estimatedCostUsd: estimateCost(input.duration, "openai")
  };
}

async function transcribeWithDeepgram(input, options = {}) {
  const apiKey = String(options.apiKey || "").trim();
  if (!apiKey) {
    throw userError("缺少 DEEPGRAM_API_KEY。长音频需要在 Cloudflare 环境变量里配置 Deepgram API Key。", 400, {
      setupRequired: true,
      provider: "deepgram"
    });
  }

  const model = input.deepgramModel || defaultDeepgramModel;
  const language = input.language || "zh";
  const endpoint = new URL(deepgramTranscriptionEndpoint);
  endpoint.searchParams.set("model", model);
  endpoint.searchParams.set("language", language);
  endpoint.searchParams.set("smart_format", "true");
  endpoint.searchParams.set("punctuate", "true");
  endpoint.searchParams.set("paragraphs", "true");
  endpoint.searchParams.set("utterances", "true");

  const upstream = await fetch(endpoint.href, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url: options.audioUrl }),
    signal: options.signal
  });

  const responseText = await upstream.text();
  if (!upstream.ok) {
    throw userError(parseDeepgramError(responseText) || `Deepgram 转写失败：HTTP ${upstream.status}`, upstream.status, {
      provider: "deepgram"
    });
  }

  const data = safeJson(responseText);
  const transcript = extractDeepgramTranscript(data);
  if (!transcript) {
    throw userError("Deepgram 没有返回可用 transcript。", 502, { provider: "deepgram" });
  }

  return {
    ok: true,
    sourceType: "deepgram-transcribe",
    provider: "deepgram",
    model,
    language,
    transcript,
    audioBytes: options.audioBytes,
    durationSeconds: data.metadata?.duration || parseDurationToSeconds(input.duration),
    requestId: data.metadata?.request_id || "",
    estimatedCostUsd: estimateCost(input.duration || data.metadata?.duration, "deepgram")
  };
}

export function estimateCost(duration, provider = "openai") {
  const seconds = parseDurationToSeconds(duration);
  if (!seconds) return null;
  const rate = provider === "deepgram" ? deepgramCostPerMinuteUsd : openAiCostPerMinuteUsd;
  return Number(((seconds / 60) * rate).toFixed(4));
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
      headers: { "User-Agent": "PodNote/0.11.0" },
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
      "User-Agent": "PodNote/0.11.0"
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
    maxBytes: maxOpenAiAudioBytes,
    provider: "openai"
  });
}

function chooseProvider(requestedProvider, audioBytes) {
  if (requestedProvider === "openai" || requestedProvider === "deepgram") return requestedProvider;
  return Number(audioBytes || 0) > maxOpenAiAudioBytes ? "deepgram" : "openai";
}

function extractDeepgramTranscript(data) {
  const utterances = data?.results?.utterances;
  if (Array.isArray(utterances) && utterances.length) {
    return utterances
      .map((utterance) => {
        const text = String(utterance.transcript || "").trim();
        if (!text) return "";
        const speaker = Number.isFinite(utterance.speaker) ? ` 说话人${utterance.speaker + 1}：` : " ";
        return `[${secondsToTimestamp(utterance.start)}]${speaker}${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  const alternative = data?.results?.channels?.[0]?.alternatives?.[0];
  const sentences = alternative?.paragraphs?.paragraphs?.flatMap((paragraph) => paragraph.sentences || []) || [];
  if (sentences.length) {
    return sentences
      .map((sentence) => {
        const text = String(sentence.text || "").trim();
        return text ? `[${secondsToTimestamp(sentence.start)}] ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (Array.isArray(alternative?.words) && alternative.words.length) {
    return wordsToTimestampedLines(alternative.words);
  }

  return String(alternative?.transcript || "").trim();
}

function wordsToTimestampedLines(words) {
  const lines = [];
  let current = [];
  let start = 0;

  for (const word of words) {
    const text = word.punctuated_word || word.word;
    if (!text) continue;
    if (!current.length) start = word.start || 0;
    current.push(text);
    const isSentenceEnd = /[。.!?！？]$/.test(text);
    if (isSentenceEnd || current.length >= 26) {
      lines.push(`[${secondsToTimestamp(start)}] ${current.join(" ")}`);
      current = [];
    }
  }

  if (current.length) lines.push(`[${secondsToTimestamp(start)}] ${current.join(" ")}`);
  return lines.join("\n");
}

function secondsToTimestamp(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
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

function parseDeepgramError(text) {
  const data = safeJson(text);
  return data?.err_msg || data?.error || data?.message || "";
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

function pad(value) {
  return String(value).padStart(2, "0");
}
