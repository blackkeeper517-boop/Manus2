import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb, checksumForFile } from "../server/db";
import { vaultFiles, vaultProjects } from "../drizzle/schema";

const sourceDir = "/home/ubuntu/work_thai_order_parser";
const ownerId = 1;

function classify(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".sql") return { language: "sql", kind: "sql" as const };
  if (ext === ".json") return { language: "json", kind: "workflow" as const };
  if (ext === ".md") return { language: "markdown", kind: "document" as const };
  if (ext === ".html") return { language: "html", kind: "document" as const };
  if (ext === ".js") return { language: "javascript", kind: "code" as const };
  if (ext === ".ts") return { language: "typescript", kind: "code" as const };
  if (ext === ".tsx") return { language: "typescriptreact", kind: "code" as const };
  if (ext === ".py") return { language: "python", kind: "code" as const };
  return { language: "text", kind: "other" as const };
}

function sanitize(content: string) {
  // Never copy a bearer credential from an exported workflow into the vault.
  return content.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED - use n8n credential]");
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const projectName = "Thai Order Product Parser";
  const existingProject = await db.select().from(vaultProjects).where(and(eq(vaultProjects.ownerId, ownerId), eq(vaultProjects.name, projectName))).limit(1);
  let projectId = existingProject[0]?.id;
  if (!projectId) {
    const inserted = await db.insert(vaultProjects).values({
      ownerId,
      name: projectName,
      slug: "thai-order-product-parser",
      description: "SQL, n8n workflows, parser code, and Telegram delivery safeguards.",
      category: "e-commerce",
    });
    projectId = Number(inserted[0].insertId);
  }

  const names = (await readdir(sourceDir)).filter(name => !name.startsWith(".")).sort();
  let insertedCount = 0;
  let skippedCount = 0;
  for (const name of names) {
    const absolutePath = path.join(sourceDir, name);
    const raw = await readFile(absolutePath, "utf8");
    const content = sanitize(raw);
    const { language, kind } = classify(name);
    const vaultPath = `source/${name}`;
    const existing = await db.select({ id: vaultFiles.id }).from(vaultFiles).where(and(eq(vaultFiles.projectId, projectId), eq(vaultFiles.path, vaultPath))).limit(1);
    if (existing[0]) {
      skippedCount += 1;
      continue;
    }
    await db.insert(vaultFiles).values({
      projectId,
      ownerId,
      path: vaultPath,
      title: name,
      language,
      kind,
      content,
      checksum: checksumForFile(content),
      sizeBytes: Buffer.byteLength(content, "utf8"),
    });
    insertedCount += 1;
  }

  console.log(JSON.stringify({ projectId, sourceFiles: names.length, insertedCount, skippedCount }));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
