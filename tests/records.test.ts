import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, achReady, bestiaryNext, claimAchievement, claimBestiary } from "../src/core/records";
import { mulberry32 } from "../src/core/rng";
import { finishRun, hardOpen } from "../src/core/run";
import { loadoutOf, newSave, normalize } from "../src/core/save";
import { HARD_HP, World } from "../src/game/world";

describe("ハード・図鑑・実績", () => {
  it("ハードは ノーマルで クリアした章だけ。敵が 強い。記録は 別。章は 開かない", () => {
    const s = newSave();
    expect(hardOpen(s, 1)).toBe(false);
    s.best[1] = 10;
    expect(hardOpen(s, 1)).toBe(true);
    const n = new World(loadoutOf(s), 1, mulberry32(1)), hd = new World(loadoutOf(s), 1, mulberry32(1), "chatora", 10, 0, true);
    expect(hd.enemies[0].maxHp).toBeCloseTo(n.enemies[0].maxHp * HARD_HP);
    const r = finishRun(s, { chapter: 1, stage: 10, won: true, coins: 0, drops: [], hard: true });
    expect(s.hardBest[1]).toBe(10);
    expect(s.unlocked).toBe(1);
    expect(r.churu).toBe(50);
  });
  it("図鑑: 倒した数で 段ごとに 受け取れる。セーブに 残る", () => {
    const s = newSave();
    finishRun(s, { chapter: 1, stage: 3, won: false, coins: 0, drops: [], killsBy: { ari: 120 } });
    expect(claimBestiary(s, "ari")).toBe(5);
    expect(claimBestiary(s, "ari")).toBe(10);
    expect(claimBestiary(s, "ari")).toBe(0);
    expect(bestiaryNext(s, "hae")?.ready).toBe(false);
    expect(normalize(JSON.parse(JSON.stringify(s))).bestiary.ari).toBe(120);
  });
  it("実績: できたら 1回だけ 受け取れる", () => {
    const s = newSave();
    s.best[5] = 10; s.towerBest = 12;
    const ch5 = ACHIEVEMENTS.find((a) => a.id === "ch5")!;
    expect(achReady(s, ch5)).toBe(true);
    expect(claimAchievement(s, "ch5")).toBe(true);
    expect(claimAchievement(s, "ch5")).toBe(false);
    expect(claimAchievement(s, "tower10")).toBe(true);
    expect(s.stones).toBe(10);
    expect(claimAchievement(s, "ch10")).toBe(false);
  });
});
