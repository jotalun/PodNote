import { getConfigSnapshot } from "../../lib/metering.js";

export function onRequestGet({ env }) {
  return sendJson(getConfigSnapshot(env));
}

function sendJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
