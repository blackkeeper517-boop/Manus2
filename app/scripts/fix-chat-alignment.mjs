import { readFileSync, writeFileSync } from "node:fs";
const path = "client/src/pages/ChatHub.tsx";
const source = readFileSync(path, "utf8");
const oldText = 'className={`max-w-[82%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-violet-50/85 shadow-lg`}';
const newText = 'className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg ${isPageTimelineLine(line) ? "ml-auto rounded-br-md bg-gradient-to-br from-fuchsia-600/80 to-violet-600/80 text-white" : "rounded-bl-md border border-white/10 bg-white/[0.06] text-violet-50/85"}`}';
if (!source.includes(oldText)) throw new Error("Expected historical bubble class was not found");
writeFileSync(path, source.replace(oldText, newText));
console.log("updated historical bubble alignment");
