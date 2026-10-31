import { describe, expect, it } from "vitest";
import { ART_SETS, artifactEffects, artStats, setLevel, starCost, starUp, wish, WISH_PITY } from "../src/core/artifacts";
import { mulberry32 } from "../src/core/rng";
import { loadoutOf, newSave, normalize } from "../src/core/save";

describe("宝物（アーティファクト）", () => {
  it("★0が 基本、★1つで +50%。かけら: 解放10・レジェンド 20・40…・ミシック ★8まで10・★14まで20・★15 30", () => {
    expect(artStats("manekineko", 0)).toEqual({ atk: 36, hp: 144 });
    expect(artStats("manekineko", 2).atk).toBeCloseTo(72);
    const sum = (id: string) => Array.from({ length: 15 }, (_, s) => starCost(id, s)!).reduce((a, b) => a + b, 10);
    expect(sum("silverdish")).toBe(2410);
    expect(sum("manekineko")).toBe(240);
    expect(starCost("lamp", 15)).toBeNull();
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
  it("かけらで 解放・星上げ", () => {
    const s = newSave();
    s.artifacts.lamp = { owned: false, star: 0, shards: 25 };
    expect(starUp(s, "lamp")).toBe(true);
    expect(s.artifacts.lamp).toEqual({ owned: true, star: 0, shards: 15 });
    expect(starUp(s, "lamp")).toBe(true);
    expect(starUp(s, "lamp")).toBe(false);
    expect(s.artifacts.lamp).toEqual({ owned: true, star: 1, shards: 5 });
  });
  it("セット: ぜんぶ持つと 発動、全部 ★3 で 段が上がる。力は 戦いに 入る", () => {
    const s = newSave();
    const gold = ART_SETS.find((x) => x.id === "gold")!;
    s.artifacts = { manekineko: { owned: true, star: 3, shards: 0 }, kinkeito: { owned: true, star: 4, shards: 0 } };
    expect(setLevel(s, gold)).toBe(-1);
    s.artifacts.kinsuzu = { owned: true, star: 2, shards: 0 };
    expect(setLevel(s, gold)).toBe(0);
    s.artifacts.kinsuzu.star = 3;
    expect(setLevel(s, gold)).toBe(1);
    const e = artifactEffects(s);
    expect(e.atkPct).toBeCloseTo(0.18);
    expect(e.dodge).toBeCloseTo(0.04);
    const base = loadoutOf(newSave()).atk;
    expect(loadoutOf(s).atk).toBeGreaterThan(base * 1.18);
    expect(normalize(JSON.parse(JSON.stringify(s))).artifacts.kinsuzu.star).toBe(3);
    // 前の形（★1から）も 読める
    expect(normalize({ artifacts: { lamp: { star: 2, shards: 1 } } }).artifacts.lamp).toEqual({ owned: true, star: 1, shards: 1 });
  });
});
