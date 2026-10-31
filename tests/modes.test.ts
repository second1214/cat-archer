import { describe, expect, it } from "vitest";
import { claimBonus, claimMission, MISSIONS, missionState, track } from "../src/core/missions";
import { claimPatrol, patrolCoinsPerHour, patrolPending } from "../src/core/patrol";
import { mulberry32 } from "../src/core/rng";
import { finishRun } from "../src/core/run";
import { G } from "../src/core/runes";
import { loadoutOf, newSave } from "../src/core/save";
import { rollSkills, SKILLS } from "../src/core/skills";
import { finishTower, towerChapter, towerStart } from "../src/core/tower";
import { World } from "../src/game/world";

const H = 3600000;

describe("3択: レア度・引きなおし。復活", () => {
  it("エピックの スキルは ふつうより 出にくい", () => {
    const rng = mulberry32(1), cnt: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) for (const id of rollSkills({}, rng, 1)) cnt[id] = (cnt[id] ?? 0) + 1;
    expect(cnt.front ?? 0).toBeLessThan((cnt.atk ?? 0) * 0.6);
    expect(SKILLS.find((s) => s.id === "laser")!.tier).toBe(2);
  });
  it("引きなおすと 今の3つは 出ない。回数は 2回", () => {
    const w = new World(loadoutOf(newSave()), 1, mulberry32(2));
    w.pendingLevels = 1;
    (w as unknown as { offerLevel(): void }).offerLevel();
    const a = [...w.choices!];
    expect(w.reroll()).toBe(true);
    expect(w.choices!.some((x) => a.includes(x))).toBe(false);
    expect(w.reroll()).toBe(true);
    expect(w.reroll()).toBe(false);
  });
  it("やられたら 1回だけ 体力満タンで 続けられる", () => {
    const w = new World(loadoutOf(newSave()), 1, mulberry32(3));
    w.state = "dead"; w.hero.hp = 0;
    expect(w.continueRun()).toBe(true);
    expect(w.hero.hp).toBe(w.hero.maxHp);
    w.state = "dead";
    expect(w.continueRun()).toBe(false);
  });
});

describe("キャットタワー", () => {
  it("階で 強くなり、5階ごとに ボス。終わりは ない", () => {
    const w = new World(loadoutOf(newSave()), towerChapter(11), mulberry32(4), "chatora", Infinity, 11);
    expect(w.stage).toBe(11);
    expect(w.pendingLevels + (w.choices ? 0 : 0)).toBeGreaterThan(0);
    expect(w.chapterAt(30)).toBeGreaterThan(w.chapterAt(11));
    w.startStage(15);
    expect(w.enemies.some((e) => e.def.boss)).toBe(true);
  });
  it("はじめての階だけ ごほうび。10階ごとに チェックポイント", () => {
    const s = newSave();
    const r = finishTower(s, 10);
    expect(r.stones).toBe(10);
    expect(r.churu).toBe(20);
    expect(s.runeMats[G.epic]).toBe(1);
    expect(finishTower(s, 10).stones).toBe(0);
    expect(towerStart(s.towerBest)).toBe(11);
    expect(towerStart(9)).toBe(1);
  });
});

describe("パトロール・毎日のミッション", () => {
  it("時間で たまり、12時間で 止まる", () => {
    const s = newSave();
    s.unlocked = 10;
    expect(claimPatrol(s, H).coins).toBe(0);
    expect(patrolPending(s, 3 * H).coins).toBe(2 * patrolCoinsPerHour(10));
    expect(patrolPending(s, 100 * H).hours).toBe(12);
    const r = claimPatrol(s, 14 * H);
    expect(r.churu).toBe(12);
    expect(r.stones).toBe(6);
    expect(patrolPending(s, 14 * H).coins).toBe(0);
  });
  it("ステージ・虫・強化で すすみ、受け取れる。ぜんぶで ボーナス。日が かわると もどる", () => {
    const s = newSave();
    const day = missionState(s).day;
    finishRun(s, { chapter: 1, stage: 5, won: true, coins: 0, drops: [], kills: 160 });
    finishRun(s, { chapter: 1, stage: 5, won: false, coins: 0, drops: [] });
    expect(missionState(s, day).prog.stages).toBe(14);
    expect(claimMission(s, "stages", day)).toBe(10);
    expect(claimMission(s, "stages", day)).toBe(0);
    track(s, "grow", 3, day); track(s, "daily", 2, day);
    for (const m of MISSIONS) claimMission(s, m.id, day);
    expect(claimBonus(s, day)).toBe(true);
    expect(missionState(s, "2099-01-01").prog.kills).toBe(0);
  });
});
