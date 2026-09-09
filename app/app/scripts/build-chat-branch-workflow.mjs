import { readFileSync, writeFileSync } from "node:fs";
const sourcePath = "/home/ubuntu/work_thai_order_parser/thai-order-telegram-packer-fixed.json";
const outPath = "/home/ubuntu/thai-order-project-vault/n8n/thai-order-chat-branch-added.json";
const workflow = JSON.parse(readFileSync(sourcePath, "utf8"));
const code = name => readFileSync(`/home/ubuntu/thai-order-project-vault/n8n/${name}`, "utf8");
const baseX = 760;
const nodes = [
  {
    parameters: { mode: "runOnceForAllItems", jsCode: code("HERMES_CHAT_RAW_ALL.js") },
    id: "hermes-chat-raw-all", name: "🌌 HERMES_CHAT_RAW_ALL", type: "n8n-nodes-base.code", typeVersion: 2,
    position: [baseX, 620],
  },
  {
    parameters: { mode: "runOnceForAllItems", jsCode: code("CUSTOMER_CHAT_PROCESSOR.js") },
    id: "customer-chat-processor", name: "💬 CUSTOMER_CHAT_PROCESSOR", type: "n8n-nodes-base.code", typeVersion: 2,
    position: [baseX + 300, 520],
  },
  {
    parameters: { mode: "runOnceForAllItems", jsCode: code("PAGE_CHAT_PROCESSOR.js") },
    id: "page-chat-processor", name: "🟣 PAGE_CHAT_PROCESSOR", type: "n8n-nodes-base.code", typeVersion: 2,
    position: [baseX + 300, 720],
  },
];
workflow.name = "Thai Order + HERMES Customer/Page Chat Branch";
workflow.nodes = [...workflow.nodes.filter(node => !nodes.some(add => add.id === node.id)), ...nodes];
workflow.connections = workflow.connections ?? {};
workflow.connections["🌌HERMES_DATA_JOURNEY1"] = {
  main: [[{ node: "🍁🎱ORDERMYSTORY", type: "main", index: 0 }, { node: "🌌 HERMES_CHAT_RAW_ALL", type: "main", index: 0 }]],
};
workflow.connections["🌌 HERMES_CHAT_RAW_ALL"] = {
  main: [[{ node: "💬 CUSTOMER_CHAT_PROCESSOR", type: "main", index: 0 }, { node: "🟣 PAGE_CHAT_PROCESSOR", type: "main", index: 0 }]],
};
workflow.connections["💬 CUSTOMER_CHAT_PROCESSOR"] = { main: [[]] };
workflow.connections["🟣 PAGE_CHAT_PROCESSOR"] = { main: [[]] };
workflow.active = false;
workflow.settings = { ...(workflow.settings ?? {}), executionOrder: "v1" };
writeFileSync(outPath, JSON.stringify(workflow, null, 2) + "\n");
console.log(`created=${outPath}`);
console.log(`nodes=${workflow.nodes.length}`);
console.log(`api_branch=🌌HERMES_DATA_JOURNEY1 -> 🌌 HERMES_CHAT_RAW_ALL -> customer/page processors`);
console.log(`order_branch=🌌HERMES_DATA_JOURNEY1 -> 🍁🎱ORDERMYSTORY (preserved)`);
