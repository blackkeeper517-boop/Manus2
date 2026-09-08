// api/index.ts
//
// Vercel serverless entrypoint. This mirrors server/_core/index.ts but
// WITHOUT the port-scanning / app.listen() logic (Vercel manages the
// process for you) and WITHOUT the Vite dev-server branch (not needed
// in production; static files are served by Vercel's CDN instead).
//
// Place this file at <project-root>/api/index.ts, and add the
// vercel.json in this same folder at <project-root>/vercel.json.
//
// PATHS BELOW ASSUME your real repo layout is:
//   server/_core/index.ts   (the file you showed me)
//   server/_core/oauth.ts
//   server/_core/storageProxy.ts
//   server/_core/context.ts
//   server/routers.ts
//   server/meta.ts
//   server/db.ts
// That's what "../oauth", "../routers", "../meta" etc. in your
// server/_core/index.ts imply. If your actual folder names differ,
// adjust the import paths below to match — I only received a flat
// export of your files, not the real directory tree, so I could not
// verify this myself.

import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth.js";
import { registerStorageProxy } from "../server/_core/storageProxy.js";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { extractMetaMessages, verifyMetaSignature } from "../server/meta.js";
import { createAuditLog, saveChatMessage } from "../server/db.js";

const app = express();

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
    },
  })
);
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerStorageProxy(app);
registerOAuthRoutes(app);

app.get("/api/meta/webhook", (req, res) => {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");
  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/api/meta/webhook", async (req, res) => {
  const signature = req.header("x-hub-signature-256");
  const rawBody = (req as express.Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  if (!verifyMetaSignature(rawBody, signature)) return res.sendStatus(403);
  try {
    const events = extractMetaMessages(req.body);
    for (const event of events) {
      await saveChatMessage({ ...event, senderType: "customer", direction: "inbound" });
      await createAuditLog({
        action: "message_received",
        entityType: "chat_message",
        entityId: event.providerMessageId,
        pageId: event.pageId,
        threadId: event.threadId,
        metadata: {
          provider: "meta",
          hasText: Boolean(event.text),
          attachmentCount: event.attachments?.length ?? 0,
        },
      });
    }
    return res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    console.error("[Meta Webhook] ingestion failed:", error instanceof Error ? error.message : "unknown error");
    return res.sendStatus(500);
  }
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// NOTE: no serveStatic(app) / setupVite(app, server) here — on Vercel,
// static frontend files are served directly by the platform (see
// vercel.json), not by this function. This function only ever needs
// to answer /api/* requests.

// IMPORTANT: no app.listen() — Vercel's Node runtime calls this
// exported handler directly per-request.
export default app;
