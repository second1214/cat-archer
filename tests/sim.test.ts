// バランスの目安（よけ方の へたな ボット）。人なら これより先へ行ける。
import { describe, expect, it } from "vitest";
import { loadoutOf, newSave } from "../src/core/save";
import { MAX_LEVEL, type Rarity } from "../src/core/equip";
import { runBot, STRONG } from "./bot";
import { equipRune } from "../src/core/run";
import type { RuneId } from "../src/core/runes";

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
  const RUNE_SET: RuneId[] = ["tsume", "akaiten", "dragon", "ricochet", "yoru", "netsu", "timeSword", "potion", "guardian", "revive"];
  const strong = (r: Rarity, tl: number, rg = -1, eq = -1) => {
    const s = newSave();
    const ids = ["hw_lantern", "hw_mantle", "hw_hat", "hw_collar", "hw_charm"];
    s.items = ids.map((id, i) => ({ uid: i + 1, id, r, lv: MAX_LEVEL[r] }));
    s.equipped = { weapon: 1, clothes: 2, hat: 3, collar: 4, charm: 5 };
    for (const k of Object.keys(s.talents)) (s.talents as Record<string, number>)[k] = tl;
    if (rg >= 0) RUNE_SET.forEach((id, i) => {
      s.runes.push({ uid: 100 + i, id, g: Math.max(rg, 2), ...(eq >= 0 ? { en: [{ opt: ["guardian", "revive", "yoru"].includes(id) ? "critDmg" : "famDmg", q: eq }, { opt: "boss", q: eq }] } : {}) });
      equipRune(s, 100 + i);
    });
    return loadoutOf(s);
  };
  const won = (lo: ReturnType<typeof strong>, ch: number) => [1, 2].filter((sd) => runBot(lo, ch, sd, 900, STRONG).state === "won").length;
  it("カオス一式（修行最大）でも ルーンなしでは 25章を こえられない", () => {
    expect(won(strong(10, 30), 25)).toBe(0);
  });
  it("カオス＋ミシックのルーン・付与なら 35章を クリア。ルーンの育成が 先へ進む カギ", () => {
    expect(won(strong(10, 30, 10, 5), 35)).toBe(2);
  });
});
