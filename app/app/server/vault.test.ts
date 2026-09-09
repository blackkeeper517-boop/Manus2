import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { checksumForFile } from "./db";
import type { TrpcContext } from "./_core/context";

function unauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("project vault", () => {
  it("creates a stable SHA-256 checksum for file content", () => {
    expect(checksumForFile("Thai Order\n")).toBe("b9264ac7f16a485e26de961458842fe8bbabfb2ff75998624e22f3281c8e75c9");
    expect(checksumForFile("Thai Order\n")).toBe(checksumForFile("Thai Order\n"));
    expect(checksumForFile("Thai Order")).not.toBe(checksumForFile("Thai Order\n"));
  });

  it("does not expose vault projects without administrator authentication", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.vault.projects()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
