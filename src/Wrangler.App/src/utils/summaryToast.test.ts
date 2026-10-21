import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "react-toastify";
import { summaryToast } from "./summaryToast";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn() } }));

describe("summaryToast", () => {
  beforeEach(() => vi.mocked(toast.success).mockClear());

  it("names a single item", () => {
    summaryToast(["a"], (item) => `${item}: Merged`, "pull requests merged");
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("a: Merged");
  });

  it("counts several items in one toast", () => {
    summaryToast(["a", "b", "c"], (item) => `${item}: Merged`, "pull requests merged");
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("3 pull requests merged");
  });

  it("shows nothing for none", () => {
    summaryToast([], (item: string) => item, "pull requests merged");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
