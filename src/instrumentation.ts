import { captureError } from "@/lib/observability";

/**
 * Next.js server error hook — every uncaught server/SSR/route error flows here.
 * Forwards to the observability seam so production errors are captured.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routeType?: string }
) {
  captureError(error, {
    path: request?.path,
    method: request?.method,
    routeType: context?.routeType,
  });
}
