import "./lib/error-capture";

import { consumeLastCapturedError, describeError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
   fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}




// Add ?__debug=1 to any failing URL to receive the real error instead of the
// friendly page. Nothing secret is included — only the message/stack.
function wantsDebug(request: Request): boolean {
  try {
    return new URL(request.url).searchParams.get("__debug") === "1";
  } catch {
    return false;
  }
}

function errorResponse(request: Request, error: unknown): Response {
  if (wantsDebug(request)) {
    return new Response(JSON.stringify({ error: describeError(error) }, null, 2), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  request: Request,
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

    const body = await response.clone().text();
    if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
      return response;
    }

    const original = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
    console.error(original);
    return errorResponse(request, original);
}

export default {
   async fetch(request: Request, env: unknown, ctx: unknown) {
     try {
       const handler = await getServerEntry();
       const response = await handler.fetch(request, env, ctx);
       return await normalizeCatastrophicSsrResponse(request, response);
     } catch (error) {
       console.error(error);
       return errorResponse(request, error);
     }
   },
};
