import { describe, it, expect } from "vitest";
import type { ReactElement } from "react";
import { dotLabel, optionSearch } from "./filterOptions";

describe("dotLabel", () => {
  const render = dotLabel<string>(() => "green", (o) => o.toUpperCase());

  it("renders a colour dot followed by the label text", () => {
    const el = render("Success") as ReactElement<{ children: unknown[] }>;
    const [dot, text] = el.props.children as [ReactElement<{ className: string; "aria-hidden": string }>, string];
    expect(dot.props.className).toBe("dot green");
    expect(dot.props["aria-hidden"]).toBe("true");
    expect(text).toBe("SUCCESS");
  });

  it("resolves the colour class per option", () => {
    const perOption = dotLabel<{ name: string; colour: string }>((o) => o.colour, (o) => o.name);
    const el = perOption({ name: "Failure", colour: "red" }) as ReactElement<{ children: unknown[] }>;
    const [dot] = el.props.children as [ReactElement<{ className: string }>];
    expect(dot.props.className).toBe("dot red");
  });
});

describe("optionSearch", () => {
  const options = ["Success", "Failure", "Pending", "Unknown"];
  const search = optionSearch(options, (o) => o);

  it("filters case-insensitively by substring", () => {
    expect(search("fail")).toEqual(["Failure"]);
    expect(search("N")).toEqual(["Pending", "Unknown"]);
  });

  it("returns all options for empty or whitespace input", () => {
    expect(search("")).toEqual(options);
    expect(search("   ")).toEqual(options);
  });

  it("returns empty for no match", () => {
    expect(search("zzz")).toEqual([]);
  });

  it("filters on the given field for object options", () => {
    const byName = optionSearch([{ name: "Apple" }, { name: "Pear" }], (o) => o.name);
    expect(byName("pea")).toEqual([{ name: "Pear" }]);
  });
});
