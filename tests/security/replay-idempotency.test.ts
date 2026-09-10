import { describe, expect, it, vi } from "vitest";
import { createIdempotent } from "../../workflows/idempotent-create";

describe("createIdempotent — replay protection for workflow starts", () => {
  it("creates a fresh instance and returns reused:false the first time", async () => {
    const create = vi.fn().mockResolvedValue({ id: "release-1842" });
    const get = vi.fn();
    const result = await createIdempotent({ create, get }, "release-1842", { prNumber: 1842 });

    expect(result.reused).toBe(false);
    expect(result.instance.id).toBe("release-1842");
    expect(create).toHaveBeenCalledWith({ id: "release-1842", params: { prNumber: 1842 } });
    expect(get).not.toHaveBeenCalled();
  });

  it("falls back to get() and reports reused:true when create() rejects (duplicate id)", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Workflow instance already exists"));
    const get = vi.fn().mockResolvedValue({ id: "release-1842" });
    const result = await createIdempotent({ create, get }, "release-1842", { prNumber: 1842 });

    expect(result.reused).toBe(true);
    expect(get).toHaveBeenCalledWith("release-1842");
  });

  it("a retried request for the same key never results in two create() calls succeeding", async () => {
    // Simulates the real Cloudflare behavior: same id, second create() rejects.
    let created = false;
    const create = vi.fn().mockImplementation(async ({ id }: { id: string }) => {
      if (created) throw new Error(`Workflow instance ${id} already exists`);
      created = true;
      return { id };
    });
    const get = vi.fn().mockResolvedValue({ id: "release-1842" });

    const first = await createIdempotent({ create, get }, "release-1842", {});
    const second = await createIdempotent({ create, get }, "release-1842", {});

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(create).toHaveBeenCalledTimes(2); // both attempted...
    expect(get).toHaveBeenCalledTimes(1); // ...but only one actually resulted in a new instance
  });
});
