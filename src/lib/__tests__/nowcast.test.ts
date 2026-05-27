import { describe, it, expect } from "vitest";
import { summarizeNowcastPrecip } from "../nowcast";

const make = (precip: unknown[]): any => ({
  time: precip.map((_, i) => `t${i}`),
  precipitation: precip,
  weather_code: precip.map(() => 0),
  temperature_2m: precip.map(() => 0),
  wind_speed_10m: precip.map(() => 0),
});

describe("summarizeNowcastPrecip", () => {
  it("returns hasData=false for undefined input", () => {
    const r = summarizeNowcastPrecip(undefined);
    expect(r).toEqual({ sum: 0, validCount: 0, requested: 8, hasData: false });
  });

  it("returns hasData=false when precipitation is missing", () => {
    const r = summarizeNowcastPrecip({} as any);
    expect(r.hasData).toBe(false);
    expect(r.sum).toBe(0);
  });

  it("handles non-array precipitation gracefully", () => {
    const r = summarizeNowcastPrecip({ precipitation: "oops" as any });
    expect(r.hasData).toBe(false);
    expect(r.sum).toBe(0);
  });

  it("sums first N slots correctly", () => {
    const r = summarizeNowcastPrecip(make([0.1, 0.2, 0.3, 0.4, 0, 0, 0, 0, 99]), 8);
    expect(r.sum).toBeCloseTo(1.0, 5);
    expect(r.validCount).toBe(8);
    expect(r.hasData).toBe(true);
  });

  it("ignores null, undefined and NaN entries", () => {
    const r = summarizeNowcastPrecip(make([0.5, null, undefined, NaN, 0.5, 0, 0, 0]), 8);
    expect(r.sum).toBeCloseTo(1.0, 5);
    expect(r.validCount).toBe(5);
    expect(r.hasData).toBe(true);
  });

  it("clamps negative values to 0", () => {
    const r = summarizeNowcastPrecip(make([-1, -0.5, 0.3, 0.2]), 4);
    expect(r.sum).toBeCloseTo(0.5, 5);
    expect(r.validCount).toBe(4);
  });

  it("ignores Infinity", () => {
    const r = summarizeNowcastPrecip(make([Infinity, -Infinity, 0.2]), 3);
    expect(r.sum).toBeCloseTo(0.2, 5);
    expect(r.validCount).toBe(1);
  });

  it("works when array is shorter than count", () => {
    const r = summarizeNowcastPrecip(make([0.1, 0.2]), 8);
    expect(r.sum).toBeCloseTo(0.3, 5);
    expect(r.validCount).toBe(2);
    expect(r.hasData).toBe(true);
  });

  it("returns 0 for empty array", () => {
    const r = summarizeNowcastPrecip(make([]), 8);
    expect(r.hasData).toBe(false);
    expect(r.sum).toBe(0);
  });

  it("handles count <= 0", () => {
    const r = summarizeNowcastPrecip(make([0.5, 0.5]), 0);
    expect(r.hasData).toBe(false);
    expect(r.requested).toBe(0);
  });

  it("treats all-zero data as hasData=true with sum=0", () => {
    const r = summarizeNowcastPrecip(make([0, 0, 0, 0, 0, 0, 0, 0]), 8);
    expect(r.hasData).toBe(true);
    expect(r.sum).toBe(0);
  });
});
