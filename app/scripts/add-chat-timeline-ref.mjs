import { readFileSync, writeFileSync } from "node:fs";
const path = "client/src/pages/ChatHub.tsx";
let source = readFileSync(path, "utf8");
const needle = '<div className="flex min-h-[430px] flex-col justify-end gap-3 overflow-y-auto bg-[radial-gradient(circle_at_70%_20%,rgba(168,85,247,0.09),transparent_32%),#0b0910] p-5">';
if (!source.includes(needle)) throw new Error("timeline viewport not found");
source = source.replace(needle, '<div ref={chatTimelineRef} className="flex min-h-[430px] flex-col justify-end gap-3 overflow-y-auto bg-[radial-gradient(circle_at_70%_20%,rgba(168,85,247,0.09),transparent_32%),#0b0910] p-5">');
writeFileSync(path, source);
console.log("timeline ref added");
