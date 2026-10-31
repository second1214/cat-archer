import { describe, expect, it } from "vitest";
import { DAILY_STAGES, DAILY_TRIES, dailyReward, finishDaily, maxLevel, sweepDaily, triesLeft } from "../src/core/daily";
import { mulberry32 } from "../src/core/rng";
import { loadoutOf, newSave, normalize } from "../src/core/save";
import { World } from "../src/game/world";

describe("毎日の挑戦", () => {
  it("1日2回。日が かわると もどる。解放前は できない", () => {
    const s = newSave();
    expect(finishDaily(s, "nibo", 1, 5, "2026-10-31")).toBeNull(); // 3章から
    s.unlocked = 5;
    for (let i = 0; i < DAILY_TRIES; i++) expect(finishDaily(s, "nibo", 1, 2, "2026-10-31")).not.toBeNull();
    expect(triesLeft(s, "nibo", "2026-10-31")).toBe(0);
    expect(finishDaily(s, "nibo", 1, 2, "2026-10-31")).toBeNull();
    expect(triesLeft(s, "nibo", "2026-11-01")).toBe(DAILY_TRIES);
    expect(triesLeft(s, "tsume", "2026-11-01")).toBe(DAILY_TRIES);
  });
  it("クリアで 次のレベル。やられても 進んだ分。掃討は クリアした いちばん上で", () => {
    const s = newSave();
    s.unlocked = 5;
    expect(finishDaily(s, "tsume", 2, 5, "d")).toBeNull(); // まだ Lv1 だけ
    const part = finishDaily(s, "tsume", 1, 2, "d")!;
    expect(part.stones).toBe(2);
    expect(part.mats).toBeNull();
    expect(maxLevel(s, "tsume")).toBe(1);
    const full = finishDaily(s, "tsume", 1, DAILY_STAGES, "d")!;
    expect(full.mats).toEqual({ g: 0, n: 2 });
    expect(s.runeMats[0]).toBe(2);
    expect(maxLevel(s, "tsume")).toBe(2);
    expect(sweepDaily(s, "tsume", "d")).toBeNull(); // 回数切れ
    expect(sweepDaily(s, "tsume", "e")).toEqual(dailyReward("tsume", 1, DAILY_STAGES));
  });
  it("レベルが 上がると もらえる物が ふえ、ルーン素材の 品質も 上がる", () => {
    expect(dailyReward("nibo", 10, 5).coins).toBeGreaterThan(dailyReward("nibo", 5, 5).coins * 3);
    expect(dailyReward("tsume", 13, 5).mats!.g).toBe(3);
    expect(dailyReward("tsume", 24, 5).stones).toBeGreaterThan(dailyReward("tsume", 1, 5).stones);
  });
  it("セーブに 残る。戦いは 5面で おしまい", () => {
    const s = newSave();
    s.unlocked = 5; s.daily.best.nibo = 3;
    expect(normalize(JSON.parse(JSON.stringify(s))).daily.best.nibo).toBe(3);
    const w = new World(loadoutOf(s), 3, mulberry32(1), "chatora", DAILY_STAGES);
    w.stage = DAILY_STAGES;
    for (const e of w.enemies) e.dead = true;
    for (let i = 0; i < 30 && w.state === "fight"; i++) w.step(1 / 60, { mx: 0, my: 0 });
    expect(w.state).toBe("won");
  });
});
