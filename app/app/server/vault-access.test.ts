import { describe, expect, it } from "vitest";
import { verifyVaultAccessCode } from "./vault-access";

describe("vault access code", () => {
  it("accepts the configured secret and rejects a wrong code", () => {
    const configured = process.env.VAULT_ACCESS_CODE;
    expect(configured, "VAULT_ACCESS_CODE must be configured for this test").toBeTruthy();
    expect(verifyVaultAccessCode(configured!)).toBe(true);
    expect(verifyVaultAccessCode(`${configured}x`)).toBe(false);
  });
});
