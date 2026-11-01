import { describe, expect, it } from "vitest";
import { claimBonus, claimMission, MISSIONS, missionState, track } from "../src/core/missions";
import { claimPatrol, patrolCoinsPerHour, patrolPending } from "../src/core/patrol";
import { mulberry32 } from "../src/core/rng";
import { finishRun } from "../src/core/run";
import { G } from "../src/core/runes";
import { loadoutOf, newSave } from "../src/core/save";
import { rollSkills, SKILLS } from "../src/core/skills";
import { finishTower, TOWER_FLOORS, towerChapter, towerRange } from "../src/core/tower";
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

describe("キャットタワー（本家の スカイタワー）", () => {
  const tw = (start: number) => new World(loadoutOf(newSave()), towerChapter(start), mulberry32(4), "chatora", start + TOWER_FLOORS - 1, start);
  it("1回 5階。階に はいるたびに スキルを選ぶ。経験値の レベルアップは ない。ボスは 区切りの階だけ", () => {
    const w = tw(11);
    expect(w.stage).toBe(11);
    expect(w.choices).not.toBeNull();
    w.chooseSkill(w.choices![0]);
    for (const e of w.enemies) e.dead = false;
    expect(w.enemies.some((e) => e.def.boss)).toBe(false);
    const lv = w.hero.level;
    for (const e of w.enemies) (w as unknown as { kill(e: unknown): void }).kill(e);
    expect(w.hero.level).toBe(lv);
    expect(w.choices).toBeNull();
    expect(w.chapterAt(40)).toBeGreaterThan(w.chapterAt(11));
    w.startStage(15);
    expect(w.enemies.some((e) => e.def.boss)).toBe(true);
  });
  it("階を クリアすると タワーの番猫（レア以上の スキル）。5階めで おしまい", () => {
    const w = tw(1);
    w.chooseSkill(w.choices![0]);
    for (const e of w.enemies) e.dead = true;
    for (let i = 0; i < 30 && w.state === "fight"; i++) w.step(1 / 60, { mx: 0, my: 0 });
    expect(w.state).toBe("clear");
    expect(w.event?.kind).toBe("guard");
    expect(w.event!.skills.every((id) => (SKILLS.find((s) => s.id === id)!.tier ?? 0) >= 1)).toBe(true);
    w.stage = TOWER_FLOORS; w.state = "fight"; w.event = null;
    for (const e of w.enemies) e.dead = true;
    for (let i = 0; i < 30 && w.state === "fight"; i++) w.step(1 / 60, { mx: 0, my: 0 });
    expect(w.state).toBe("won");
  });
  it("5階 ぜんぶ クリアしたときだけ 進む。回数の しばりは ない。25階で 大きな ごほうび", () => {
    const s = newSave();
    s.unlocked = 8; s.towerBest = 20;
    const rng = mulberry32(5);
    expect(finishTower(s, false, rng)!.churu).toBe(0);
    expect(s.towerBest).toBe(20);
    const r = finishTower(s, true, rng)!;
    expect(s.towerBest).toBe(25);
    expect(r.churu).toBe(2 * 4 + 50);
    expect(r.runes).toHaveLength(1);
    expect(s.runeMats[G.epic]).toBe(2);
    for (let i = 0; i < 4; i++) expect(finishTower(s, true, rng)).not.toBeNull();
    expect(towerRange(s)).toEqual([46, 50]);
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

describe("タワーの 改修前の ごほうび", () => {
  it("改修前の セーブで のぼった分の 鈴・核・ルーンを 1回だけ 受け取れる", async () => {
    const { normalize } = await import("../src/core/save");
    const { claimTowerBackpay } = await import("../src/core/tower");
    const s = normalize({ unlocked: 20, towerBest: 63 });
    expect(s.towerPaidTo).toBe(0);
    const r = claimTowerBackpay(s, mulberry32(1))!;
    expect(r.runes).toBe(2);
    expect(r.cores).toBe(8);
    expect(r.bells).toBe(5 * 2 + 10); // 25・50階で 5、ほかの 5の倍数 10個で 1
    expect(s.runes).toHaveLength(2);
    expect(claimTowerBackpay(s, mulberry32(1))).toBeNull();
  });
});
