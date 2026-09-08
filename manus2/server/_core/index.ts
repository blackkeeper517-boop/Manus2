import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { extractMetaMessages, verifyMetaSignature } from "../meta";
import { createAuditLog, saveChatMessage } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb", verify: (req, _res, buffer) => { (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8"); } }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.get("/api/meta/webhook", (req, res) => {
    const mode = String(req.query["hub.mode"] ?? "");
    const token = String(req.query["hub.verify_token"] ?? "");
    const challenge = String(req.query["hub.challenge"] ?? "");
    if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) return res.status(200).send(challenge);
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
        await createAuditLog({ action: "message_received", entityType: "chat_message", entityId: event.providerMessageId, pageId: event.pageId, threadId: event.threadId, metadata: { provider: "meta", hasText: Boolean(event.text), attachmentCount: event.attachments?.length ?? 0 } });
      }
      return res.status(200).send("EVENT_RECEIVED");
    } catch (error) {
      console.error("[Meta Webhook] ingestion failed:", error instanceof Error ? error.message : "unknown error");
      return res.sendStatus(500);
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
