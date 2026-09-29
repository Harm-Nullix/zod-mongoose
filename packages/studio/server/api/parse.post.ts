import { defineEventHandler, createError } from "h3";
import { executeStudio, StudioExecutionError } from "../utils/studio-execution";
import { readStudioRequest } from "../utils/parse-request";

const MAX_PENDING_PARSES = 3;
let parseQueue = Promise.resolve();
let pendingParses = 0;

async function acquireLocalLock(): Promise<() => void> {
  if (pendingParses >= MAX_PENDING_PARSES) throw createError({ statusCode: 503, message: "Studio is busy. Try again shortly." });
  pendingParses++;
  const previous = parseQueue;
  let release!: () => void;
  parseQueue = new Promise<void>((resolve) => { release = () => { pendingParses--; resolve(); }; });
  await previous;
  return release;
}

export default defineEventHandler(async (event) => {
  if (useRuntimeConfig(event).public.isDocsMode) {
    throw createError({ statusCode: 403, message: "Local Studio execution is unavailable in docs mode." });
  }
  const body = await readStudioRequest(event);
  const release = await acquireLocalLock();
  try { return executeStudio(body, 5000); }
  catch (error: any) {
    throw createError({ statusCode: error instanceof StudioExecutionError ? 400 : 500, message: error?.message || "Studio execution failed." });
  } finally { release(); }
});
