import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDuration,
  formatRelativeDay,
  isValidDate,
  isValidMonth,
  monthDateRange,
  monthInstantRange,
  shiftMonth,
  toVNDate,
  vnDateTime,
} from "@/lib/datetime";

describe("Vietnam calendar", () => {
  it("uses the Vietnam date, not UTC, around midnight", () => {
    // 17:30 UTC on 21 Sep is already 00:30 on 22 Sep in Vietnam.
    expect(toVNDate(new Date("2026-09-21T17:30:00Z"))).toBe("2026-09-22");
    expect(toVNDate(new Date("2026-09-21T16:59:59Z"))).toBe("2026-09-21");
  });

  it("builds half-open month ranges", () => {
    expect(monthDateRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    const { start, end } = monthInstantRange("2026-09");
    expect(start.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
  });

  it("combines a VN date and time into an instant", () => {
    expect(vnDateTime("2026-09-22", "18:30").toISOString()).toBe("2026-09-22T11:30:00.000Z");
  });

  it("validates inputs", () => {
    expect(isValidMonth("2026-09")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2028-02-29")).toBe(true);
  });

  it("labels relative days and durations", () => {
    expect(formatRelativeDay("2026-09-22", "2026-09-22")).toBe("Hôm nay");
    expect(formatRelativeDay("2026-09-21", "2026-09-22")).toBe("Hôm qua");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(formatDuration(90 * 60_000)).toBe("1 giờ 30 phút");
    expect(formatDuration(45 * 60_000)).toBe("45 phút");
    expect(formatDuration(120 * 60_000)).toBe("2 giờ");
  });
});
