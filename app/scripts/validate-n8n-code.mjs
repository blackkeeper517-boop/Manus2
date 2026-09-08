import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const files = process.argv.slice(2);
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const wrapped = `(async function n8nCodeNode(){\n${source}\n})`;
  const temp = `/tmp/${file.split('/').pop()}.wrapped.mjs`;
  writeFileSync(temp, wrapped);
  execFileSync(process.execPath, ["--check", temp], { stdio: "inherit" });
  console.log(`syntax_ok=${file}`);
}
