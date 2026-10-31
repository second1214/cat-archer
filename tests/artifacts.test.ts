import { describe, expect, it } from "vitest";
import { ART_SETS, artifactEffects, artStats, setLevel, starUp, wish, WISH_PITY } from "../src/core/artifacts";
import { mulberry32 } from "../src/core/rng";
import { loadoutOf, newSave, normalize } from "../src/core/save";

describe("宝物（アーティファクト）", () => {
  it("★1つで 基本の力 +50%", () => {
    expect(artStats("manekineko", 1)).toEqual({ atk: 36, hp: 144 });
    expect(artStats("manekineko", 3).atk).toBeCloseTo(72);
  });
  it("願い: 鈴を使う。確率は 本家どおり（かけらが いちばん多い）。100回で レジェンド以上", () => {
    const s = newSave();
    s.wishBells = 1000;
    const res = Array.from({ length: 100 }, () => wish(s, mulberry32(7), 10)!).flat();
    expect(s.wishBells).toBe(0);
    const shards = res.filter((r) => r.kind === "shard").length / res.length;
    expect(shards).toBeGreaterThan(0.6);
    expect(shards).toBeLessThan(0.8);
    let gap = 0, max = 0;
    for (const r of res) { const big = r.kind !== "shard" && ["manekineko", "kinkeito", "kinsuzu", "heartribbon", "kaigara", "neko_fue", "heartcollar", "broach", "cushion", "silverdish"].includes(r.id); gap = big ? 0 : gap + 1; max = Math.max(max, gap); }
    expect(max).toBeLessThan(WISH_PITY);
    expect(wish(s, mulberry32(1), 1)).toBeNull();
  });
  it("星上げ: ★n→★n+1 は かけら n個", () => {
    const s = newSave();
    s.artifacts.lamp = { star: 2, shards: 3 };
    expect(starUp(s, "lamp")).toBe(true);
    expect(s.artifacts.lamp).toEqual({ star: 3, shards: 1 });
    expect(starUp(s, "lamp")).toBe(false);
  });
  it("セット: ぜんぶ持つと 発動、全部 ★3 で 段が上がる。力は 戦いに 入る", () => {
    const s = newSave();
    const gold = ART_SETS.find((x) => x.id === "gold")!;
    s.artifacts = { manekineko: { star: 3, shards: 0 }, kinkeito: { star: 4, shards: 0 } };
    expect(setLevel(s, gold)).toBe(-1);
    s.artifacts.kinsuzu = { star: 2, shards: 0 };
    expect(setLevel(s, gold)).toBe(0);
    s.artifacts.kinsuzu.star = 3;
    expect(setLevel(s, gold)).toBe(1);
    const e = artifactEffects(s);
    expect(e.atkPct).toBeCloseTo(0.18);
    expect(e.dodge).toBeCloseTo(0.04);
    const base = loadoutOf(newSave()).atk;
    expect(loadoutOf(s).atk).toBeGreaterThan(base * 1.18);
    expect(normalize(JSON.parse(JSON.stringify(s))).artifacts.kinsuzu.star).toBe(3);
  });
});
