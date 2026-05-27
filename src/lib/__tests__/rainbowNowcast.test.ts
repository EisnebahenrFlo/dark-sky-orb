import { describe, it, expect } from "vitest";
import {
  buildPoints,
  buildSegments,
  buildMarkers,
  buildSummary,
  computeRateCeiling,
  findPeak,
  formatOffset,
  intensityLabel,
  normalizeType,
} from "../rainbowNowcast";
import type { RainbowNowcastItem } from "@/hooks/useRainbowNowcast";

const NOW = 1_700_000_000;
const VB_W = 600;
const VB_H = 100;

const mk = (offsetMin: number, rate: number, type = "rain"): RainbowNowcastItem => ({
  precipRate: rate,
  precipType: type as any,
  timestampBegin: NOW + offsetMin * 60,
  timestampEnd: NOW + (offsetMin + 10) * 60,
});

describe("normalizeType", () => {
  it("maps known kinds", () => {
    expect(normalizeType("rain")).toBe("rain");
    expect(normalizeType("snow")).toBe("snow");
    expect(normalizeType("ice")).toBe("ice");
  });
  it("falls back to 'none'", () => {
    expect(normalizeType("no_precipitation")).toBe("none");
    expect(normalizeType(undefined)).toBe("none");
    expect(normalizeType(null)).toBe("none");
    expect(normalizeType("nonsense")).toBe("none");
  });
});

describe("computeRateCeiling", () => {
  it("returns 1 for empty/zero", () => {
    expect(computeRateCeiling([])).toBe(1);
    expect(computeRateCeiling([{ rate: 0 }])).toBe(1);
  });
  it("uses stepped buckets so small drizzle is visible", () => {
    expect(computeRateCeiling([{ rate: 0.2 }])).toBe(0.5);
    expect(computeRateCeiling([{ rate: 0.7 }])).toBe(1);
    expect(computeRateCeiling([{ rate: 1.5 }])).toBe(2);
    expect(computeRateCeiling([{ rate: 4 }])).toBe(5);
    expect(computeRateCeiling([{ rate: 8 }])).toBe(10);
    expect(computeRateCeiling([{ rate: 35 }])).toBe(40);
  });
});

describe("buildPoints", () => {
  it("returns [] for missing input", () => {
    expect(buildPoints(undefined, NOW, 120, VB_W, VB_H, 5)).toEqual([]);
    expect(buildPoints([], NOW, 120, VB_W, VB_H, 5)).toEqual([]);
  });

  it("filters by window, sorts, clamps and scales", () => {
    const items = [
      mk(180, 1), // outside 120min window
      mk(30, 2),
      mk(0, 0.5),
      mk(-5, 4), // 5min ago — included by -60s..end window
    ];
    const pts = buildPoints(items, NOW, 120, VB_W, VB_H, 5);
    expect(pts).toHaveLength(3);
    expect(pts.map((p) => p.minOffset)).toEqual([0, 0, 30]); // -5min clamped to 0
    expect(pts[2].x).toBeCloseTo((30 / 120) * VB_W);
    // rate 2 of ceiling 5 → y = 100 - 40 = 60
    expect(pts[2].y).toBeCloseTo(60);
  });

  it("clamps negative/NaN rates and rates above ceiling", () => {
    const items = [mk(0, -3), mk(10, NaN), mk(20, 999)];
    const pts = buildPoints(items, NOW, 60, VB_W, VB_H, 5);
    expect(pts[0].rate).toBe(0);
    expect(pts[1].rate).toBe(0);
    expect(pts[2].rate).toBe(999);
    expect(pts[2].y).toBe(0); // clamped to ceiling
  });

  it("guards invalid timestampBegin", () => {
    const items = [{ ...mk(10, 1), timestampBegin: undefined as any }];
    expect(buildPoints(items, NOW, 60, VB_W, VB_H, 5)).toHaveLength(0);
  });
});

describe("buildSegments", () => {
  it("groups consecutive same-kind points and bridges seams", () => {
    const pts = buildPoints(
      [mk(0, 0, "none"), mk(10, 0.5), mk(20, 1), mk(30, 0, "none")],
      NOW,
      60,
      VB_W,
      VB_H,
      2,
    );
    const segs = buildSegments(pts);
    expect(segs.map((s) => s.type)).toEqual(["none", "rain", "none"]);
    // rain seg seeded with the previous "none" point for visual continuity
    expect(segs[1].points[0].type).toBe("none");
    expect(segs[1].points).toHaveLength(3);
  });
});

describe("buildMarkers", () => {
  it("emits 'beginnt' and 'endet' on transitions", () => {
    const pts = buildPoints(
      [mk(0, 0, "none"), mk(30, 1), mk(60, 1), mk(90, 0, "none")],
      NOW,
      120,
      VB_W,
      VB_H,
      2,
    );
    const m = buildMarkers(pts, 120, VB_W);
    expect(m.map((x) => x.label)).toEqual(["beginnt", "endet"]);
    expect(m[0].x).toBeCloseTo((30 / 120) * VB_W);
  });
  it("returns [] for empty input", () => {
    expect(buildMarkers([], 120, VB_W)).toEqual([]);
  });
});

describe("findPeak", () => {
  it("returns null when no precip", () => {
    const pts = buildPoints([mk(0, 0, "none")], NOW, 60, VB_W, VB_H, 1);
    expect(findPeak(pts)).toBeNull();
  });
  it("returns the highest-rate point", () => {
    const pts = buildPoints([mk(0, 0.3), mk(20, 1.2), mk(40, 0.5)], NOW, 60, VB_W, VB_H, 2);
    const peak = findPeak(pts);
    expect(peak?.rate).toBe(1.2);
    expect(peak?.minOffset).toBe(20);
  });
});

describe("buildSummary", () => {
  it("no points → no precipitation expected", () => {
    expect(buildSummary([], 120)).toEqual({ text: "Kein Niederschlag erwartet", warn: false });
  });
  it("ice anywhere → warning", () => {
    const pts = buildPoints([mk(10, 0.5, "ice")], NOW, 120, VB_W, VB_H, 1);
    const s = buildSummary(pts, 120);
    expect(s.warn).toBe(true);
    expect(s.text).toMatch(/Glatteis/);
  });
  it("all zeros → 'kein Niederschlag in den nächsten Xh'", () => {
    const pts = buildPoints([mk(0, 0, "none"), mk(30, 0, "none")], NOW, 120, VB_W, VB_H, 1);
    expect(buildSummary(pts, 120).text).toMatch(/Kein Niederschlag/);
  });
  it("currently raining with end → 'Regen noch X Minuten'", () => {
    const pts = buildPoints([mk(0, 1), mk(20, 1), mk(40, 0, "none")], NOW, 120, VB_W, VB_H, 2);
    expect(buildSummary(pts, 120).text).toBe("Regen noch 40 Minuten");
  });
  it("rain starts later → 'Regen in X Minuten'", () => {
    const pts = buildPoints([mk(0, 0, "none"), mk(45, 0.8)], NOW, 120, VB_W, VB_H, 1);
    expect(buildSummary(pts, 120).text).toBe("Regen in 45 Minuten");
  });
});

describe("formatOffset", () => {
  it("formats minute and hour offsets", () => {
    expect(formatOffset(0)).toBe("Jetzt");
    expect(formatOffset(45)).toBe("+45 Min");
    expect(formatOffset(60)).toBe("+1h");
    expect(formatOffset(150)).toBe("+2:30h");
  });
});

describe("intensityLabel", () => {
  it("buckets intensities", () => {
    expect(intensityLabel(0.05)).toBe("vernachlässigbar");
    expect(intensityLabel(0.3)).toBe("Nieselregen");
    expect(intensityLabel(1)).toBe("leicht");
    expect(intensityLabel(5)).toBe("mäßig");
    expect(intensityLabel(10)).toBe("stark");
    expect(intensityLabel(20)).toBe("sehr stark");
  });
});
