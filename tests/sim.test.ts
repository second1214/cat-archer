// バランスの目安（よけ方の へたな ボット）。人なら これより先へ行ける。
import { describe, expect, it } from "vitest";
import { loadoutOf, newSave } from "../src/core/save";
import { MAX_LEVEL, type Rarity } from "../src/core/equip";
import { runBot, STRONG } from "./bot";

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

describe("バランスの目安", () => {
  it("はじめの装備: 最初のボス（5）までは とどき、1章クリアは ときどき", () => {
    const lo = loadoutOf(newSave());
    const rs = seeds.map((s) => runBot(lo, 1, s));
    expect(rs.every((r) => r.stage >= 5)).toBe(true);
    expect(rs.filter((r) => r.state === "won").length).toBeLessThanOrEqual(seeds.length / 2);
  });
  it("装備を育てると 1章は ほぼクリアできる", () => {
    const s = newSave();
    s.items = [{ uid: 1, id: "keedama", r: 1, lv: 12 }, { uid: 2, id: "akai", r: 1, lv: 12 }];
    const rs = seeds.map((x) => runBot(loadoutOf(s), 1, x));
    expect(rs.filter((r) => r.state === "won").length).toBeGreaterThanOrEqual(seeds.length * 0.75);
  });
});

describe("強い組み合わせ（レーザー・ゆうどう・壁ではねる）が 前提の 難しさ", () => {
  const strong = (r: Rarity, tl: number) => {
    const s = newSave();
    const ids = ["hw_lantern", "hw_mantle", "hw_hat", "hw_collar", "hw_charm"];
    s.items = ids.map((id, i) => ({ uid: i + 1, id, r, lv: MAX_LEVEL[r] }));
    s.equipped = { weapon: 1, clothes: 2, hat: 3, collar: 4, charm: 5 };
    for (const k of Object.keys(s.talents)) (s.talents as Record<string, number>)[k] = tl;
    return loadoutOf(s);
  };
  it("ミシック一式でも 25章は クリアできない。カオス一式なら 25章は クリア", () => {
    expect([1, 2].some((sd) => runBot(strong(5, 20), 25, sd, 900, STRONG).state === "won")).toBe(false);
    expect([1, 2].every((sd) => runBot(strong(10, 30), 25, sd, 900, STRONG).state === "won")).toBe(true);
  });
  it("カオス一式・修行最大でも ボットは 45章を クリアできない（ルーン・腕前が いる）", () => {
    expect([1, 2].some((sd) => runBot(strong(10, 30), 45, sd, 900, STRONG).state === "won")).toBe(false);
  });
});
