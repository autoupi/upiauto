import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { describeError } from "./lib/error-capture";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    try {
      const { getRequestUrl } = await import("@tanstack/react-start/server");
      if (new URL(String(getRequestUrl())).searchParams.get("__debug") === "1") {
        return new Response(JSON.stringify({ error: describeError(error) }, null, 2), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    } catch {
      // fall through to the friendly page
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
