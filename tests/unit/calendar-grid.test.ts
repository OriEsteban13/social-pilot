import { describe, expect, it } from "vitest";
import { monthGridDays, dateKey, isSameMonth, addMonths } from "@/lib/calendar-grid";

describe("calendar grid", () => {
  it("always returns 42 days (6 full weeks)", () => {
    const grid = monthGridDays(new Date("2026-02-15"));
    expect(grid).toHaveLength(42);
  });

  it("starts the grid on a Monday", () => {
    const grid = monthGridDays(new Date("2026-02-15"));
    expect(grid[0].getDay()).toBe(1);
  });

  it("includes the 1st of the target month somewhere in the grid", () => {
    const anchor = new Date("2026-02-15");
    const grid = monthGridDays(anchor);
    const first = grid.find((d) => d.getDate() === 1 && isSameMonth(d, anchor));
    expect(first).toBeDefined();
  });

  it("formats dateKey as YYYY-MM-DD with zero-padding", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("addMonths wraps across year boundaries", () => {
    const next = addMonths(new Date("2026-12-10"), 1);
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
  });
});
