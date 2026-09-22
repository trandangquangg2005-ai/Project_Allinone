import { describe, expect, it } from "vitest";
import { amountSuggestions, formatCompactVND, formatDigitsInput, formatVND, parseVND } from "@/lib/money";

describe("parseVND", () => {
  it.each([
    ["150000", 150_000],
    ["150.000", 150_000],
    ["150,000", 150_000],
    ["1.500.000", 1_500_000],
    ["1.500.000đ", 1_500_000],
    ["200.000 ₫", 200_000],
    ["150k", 150_000],
    ["150K", 150_000],
    ["45 nghìn", 45_000],
    ["1.5tr", 1_500_000],
    ["1,5 triệu", 1_500_000],
    ["2tr5", 2_500_000],
    ["1tr25", 1_250_000],
    ["3 tỷ", 3_000_000_000],
    ["1ty2", 1_200_000_000],
    ["2m", 2_000_000],
  ])("%s → %d", (input, expected) => {
    expect(parseVND(input)).toBe(expected);
  });

  it.each(["", "abc", "12xyz", "1.5tr5", "--5"])("rejects %j", (input) => {
    expect(parseVND(input)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats đồng with dot separators and a true minus sign", () => {
    expect(formatVND(1_500_000)).toBe("1.500.000 ₫");
    expect(formatVND(-45_000)).toBe("−45.000 ₫");
    expect(formatVND(200_000, { sign: true })).toBe("+200.000 ₫");
    expect(formatVND(0, { sign: true })).toBe("0 ₫");
  });

  it("formats compact chart labels", () => {
    expect(formatCompactVND(150_000)).toBe("150k");
    expect(formatCompactVND(1_500_000)).toBe("1,5 tr");
    expect(formatCompactVND(2_000_000_000)).toBe("2 tỷ");
    expect(formatCompactVND(-3_000_000)).toBe("−3 tr");
  });

  it("formats digits while typing", () => {
    expect(formatDigitsInput("1500000")).toBe("1.500.000");
    expect(formatDigitsInput("00045")).toBe("45");
    expect(formatDigitsInput("")).toBe("");
  });

  it("suggests amounts for short numbers only", () => {
    expect(amountSuggestions("15")).toEqual([15_000, 150_000, 1_500_000]);
    expect(amountSuggestions("150000")).toEqual([]);
    expect(amountSuggestions("0")).toEqual([]);
  });
});
