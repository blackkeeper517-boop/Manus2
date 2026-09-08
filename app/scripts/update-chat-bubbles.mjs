import { readFileSync, writeFileSync } from "node:fs";
const path = "client/src/pages/ChatHub.tsx";
let source = readFileSync(path, "utf8");
const pattern = /\{\[\.\.\.visibleStoredMessages\].reverse\(\)\.map\(message => <div key=\{message\.id\}[\s\S]*?<\/div>\)\}<\/div><div className="border-t/;
const replacement = `{[...visibleStoredMessages].reverse().map(message => { const isRight = message.side === "right" || message.direction === "outbound" || message.senderType === "page"; const senderName = message.senderName ?? (isRight ? "เพจ / แอดมิน" : "ลูกค้า"); return <div key={message.id} className={\`flex w-full \${isRight ? "justify-end" : "justify-start"}\`}><div className={\`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg \${isRight ? "rounded-br-md bg-gradient-to-br from-fuchsia-600/80 to-violet-600/80 text-white" : "rounded-bl-md border border-white/10 bg-white/[0.06] text-violet-50/85"}\`}><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">{senderName}</p><p className="whitespace-pre-wrap">{message.text || "ส่งรูปภาพ"}</p>{imageUrls(message.attachmentsJson).map(url => <img key={url} src={url} alt="ไฟล์แนบจากแชท" className="mt-2 max-h-56 rounded-xl object-cover" />)}<p className="mt-1 text-[10px] opacity-50">{isRight ? "เพจ / แอดมิน" : "ลูกค้า"} · {timeLabel(String(message.occurredAt))}</p></div></div>})}</div><div className="border-t`;
if (!pattern.test(source)) throw new Error("stored bubble markup not found");
source = source.replace(pattern, replacement);
writeFileSync(path, source);
console.log("updated chat bubbles");
