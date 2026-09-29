import { createError, defineEventHandler } from "h3";
import { readStudioRequest } from "../../utils/parse-request";
import { runInContainer } from "../../utils/runner-client";

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).public.isDocsMode) {
    throw createError({
      statusCode: 403,
      message: "Use the local Studio endpoint in CLI mode.",
    });
  }
  const socketPath =
    process.env.STUDIO_RUNNER_SOCKET || "/run/zod-studio/runner.sock";
  if (!socketPath)
    throw createError({
      statusCode: 503,
      message: "Studio runner is not configured.",
    });
  const body = await readStudioRequest(event);
  try {
    return await runInContainer(body, socketPath);
  } catch (error: any) {
    if (error?.statusCode) throw error;
    throw createError({
      statusCode: 503,
      message: "Studio runner is unavailable. Try again shortly.",
    });
  }
});
