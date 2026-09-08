import { timingSafeEqual } from "node:crypto";

export function verifyVaultAccessCode(candidate: string) {
  const configured = process.env.VAULT_ACCESS_CODE ?? "";
  const supplied = String(candidate ?? "");
  if (!configured || !supplied) return false;
  const expectedBytes = Buffer.from(configured, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  if (expectedBytes.length !== suppliedBytes.length) return false;
  return timingSafeEqual(expectedBytes, suppliedBytes);
}
