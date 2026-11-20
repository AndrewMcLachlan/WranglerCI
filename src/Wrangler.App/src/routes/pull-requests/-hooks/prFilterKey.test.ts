import { describe, it, expect } from "vitest";
import { prFilterKey } from "./prFilterKey";

describe("prFilterKey", () => {
  it("keeps the unscoped key for all", () => {
    expect(prFilterKey("prStatusFilter", "all")).toBe("prStatusFilter");
  });

  it("gives every other tab a key of its own", () => {
    expect(prFilterKey("prStatusFilter", "mine")).toBe("prStatusFilter.mine");
    expect(prFilterKey("prStatusFilter", "bots")).toBe("prStatusFilter.bots");
  });
});
