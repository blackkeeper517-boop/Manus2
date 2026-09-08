import { readFileSync, writeFileSync } from "node:fs";
const path = "client/src/pages/ChatHub.tsx";
let source = readFileSync(path, "utf8");
source = source.replace('message.side === "right" || message.direction', '("side" in message && message.side === "right") || message.direction');
source = source.replace('message.senderName ?? (isRight', '("senderName" in message ? message.senderName : null) ?? (isRight');
writeFileSync(path, source);
console.log("type guards updated");
