import { readFileSync, writeFileSync } from "node:fs";
const path = "client/src/pages/ChatHub.tsx";
let source = readFileSync(path, "utf8");
const replacements = [
  ['const composer = <div className="border-t border-violet-500/10 pt-3">', 'const composer = <div className="border-t border-violet-500/10 pt-2">'],
  ['<div className="mt-2 flex items-center gap-2">', '<div className="mt-1 flex items-center gap-2">'],
  ['className="h-8 border-violet-500/10 bg-black/20 text-xs text-white placeholder:text-violet-100/20"', 'className="h-7 border-violet-500/10 bg-black/20 text-xs text-white placeholder:text-violet-100/20"'],
  ['border-b border-violet-500/10 px-5 py-4', 'border-b border-violet-500/10 px-5 py-3'],
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Expected text not found: ${before}`);
  source = source.replace(before, after);
}
writeFileSync(path, source);
console.log("compacted chat composer and header");
