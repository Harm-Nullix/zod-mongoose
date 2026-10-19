import { defineEventHandler, createError, getHeader, getRequestHeader, getRequestIP, setHeader, setResponseHeader } from "h3";

// Simple in-memory rate limiting map: IP -> array of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 8; // Allow quick edits and shortcut runs without throttling normal use.
const TIME_WINDOW = 1000; // per 1 second (1000ms)
const GLOBAL_RATE_LIMIT = 20;
let globalWindowStart = 0;
let globalRequests = 0;

const getHeaderSafe = (event: any, name: string): string | undefined => {
  try {
    const val = getRequestHeader?.(event, name) ?? getHeader?.(event, name);
    if (val !== undefined && val !== null) return Array.isArray(val) ? val[0] : String(val);
  } catch {
    // ignore
  }
  const headers = event.headers || event.node?.req?.headers || event.req?.headers;
  if (!headers) return undefined;
  if (typeof headers.get === "function") {
    const res = headers.get(name);
    return res !== null && res !== undefined ? String(res) : undefined;
  }
  const lowerName = name.toLowerCase();
  const direct = headers[lowerName] ?? headers[name];
  if (direct !== undefined && direct !== null) {
    return Array.isArray(direct) ? direct[0] : String(direct);
  }
  return undefined;
};

const setHeaderSafe = (event: any, name: string, value: string | number) => {
  try {
    setResponseHeader?.(event, name, value);
    return;
  } catch {
    // ignore
  }
  try {
    setHeader?.(event, name, value);
    return;
  } catch {
    // ignore
  }
  if (event.node?.res?.setHeader) {
    event.node.res.setHeader(name, value);
  }
};

export default defineEventHandler((event) => {
  const isDocsMode = useRuntimeConfig(event).public.isDocsMode;
  const path = event.path;

  if (!isDocsMode && path.startsWith("/api/")) {
    const host = getHeaderSafe(event, "host") || "";
    const origin = getHeaderSafe(event, "origin");
    const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    const localOrigin = !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (!localHost || !localOrigin) throw createError({ statusCode: 403, message: "Local Studio accepts only loopback requests." });
  }

  // 1. Environment Check: Disable local resolving in Docs mode
  if (isDocsMode && path.startsWith("/api/resolve")) {
    throw createError({
      statusCode: 403,
      message: "Filesystem resolution is disabled in Documentation Mode.",
    });
  }

  // 2. Rate limiting for the parse endpoint in Docs Mode
  if (isDocsMode && path === "/api/studio/run") {
    const ip = getRequestIP(event) || "unknown";
    const now = Date.now();

    const timestamps = rateLimitMap.get(ip) || [];

    // Filter timestamps within the current window
    const recentRequests = timestamps.filter((t) => now - t < TIME_WINDOW);

    if (now - globalWindowStart >= TIME_WINDOW) {
      globalWindowStart = now;
      globalRequests = 0;
    }
    if (rateLimitMap.size > 1024) {
      for (const [key, entries] of rateLimitMap) {
        if (entries.every((time) => now - time >= TIME_WINDOW)) rateLimitMap.delete(key);
      }
    }
    if (recentRequests.length >= RATE_LIMIT || globalRequests >= GLOBAL_RATE_LIMIT || (rateLimitMap.size >= 1024 && !rateLimitMap.has(ip))) {
      setHeaderSafe(event, "Retry-After", 1);
      throw createError({
        statusCode: 429,
        message: "Too many runs. Wait a moment and try again.",
      });
    }

    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
    globalRequests++;
  }
});
