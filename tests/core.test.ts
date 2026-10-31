import { describe, expect, it } from "vitest";
import { itemStats, mergePartners, rollRarity, upgradeCost, type Item } from "../src/core/equip";
import { mulberry32 } from "../src/core/rng";
import { equipItem, finishRun, mergeAll, mergeItem, openChest, upgradeItem } from "../src/core/run";
import { equippedSet, loadoutOf, newSave, normalize } from "../src/core/save";
import { rollSkills, SKILLS } from "../src/core/skills";
import { stageInfo } from "../src/core/stages";

const item = (uid: number, id: string, r: 0 | 1 | 2 | 3 = 0, lv = 1): Item => ({ uid, id, r, lv });

describe("装備", () => {
  it("同じ装備・同じレア度 3つで 1つ上になる（レベルは いちばん高いもの）", () => {
    const s = newSave();
    s.items.push(item(10, "keedama", 0, 4), item(11, "keedama", 0, 2));
    const m = mergeItem(s, 1);
    expect(m?.r).toBe(1);
    expect(m?.lv).toBe(4);
    expect(s.items.filter((x) => x.id === "keedama")).toHaveLength(1);
  });
  it("装備中のものは 材料にならない・レア度がちがうと合成できない", () => {
    const s = newSave();
    s.items.push(item(10, "akai", 0), item(11, "akai", 1));
    expect(mergePartners(s.items, s.items.find((x) => x.uid === 10)!, equippedSet(s))).toBeNull();
  });
  it("まとめて合成は できなくなるまで続ける", () => {
    const s = newSave();
    for (let i = 0; i < 8; i++) s.items.push(item(10 + i, "keedama", 0));
    const made = mergeAll(s);
    expect(made.length).toBe(4); // 9つ → レア3つ → エピック1つ
    expect(s.items.find((x) => x.id === "keedama")?.r).toBe(2);
  });
  it("強化はレベルとともに高くなり、最大レベルで止まる", () => {
    const s = newSave();
    s.coins = 1e9;
    const a = upgradeCost(s.items[0])!;
    expect(upgradeItem(s, 1)).toBe(true);
    expect(upgradeCost(s.items[0])!).toBeGreaterThan(a);
    for (let i = 0; i < 20; i++) upgradeItem(s, 1);
    expect(s.items[0].lv).toBe(10);
    expect(upgradeCost(s.items[0])).toBeNull();
  });
  it("レア度で 力が上がり、特性が使えるようになる", () => {
    expect(itemStats(item(1, "keedama", 1)).atk).toBeGreaterThan(itemStats(item(1, "keedama", 0)).atk);
    const s = newSave();
    s.items[0].r = 2;
    expect(loadoutOf(s).bounce).toBe(1);
  });
  it("落ちるレア度: ボスは エピックが出やすい", () => {
    const rng = mulberry32(3);
    const count = (boss: boolean) => Array.from({ length: 4000 }, () => rollRarity(rng, 1, boss)).filter((r) => r === 2).length;
    expect(count(true)).toBeGreaterThan(count(false) * 2);
  });
  it("宝箱は にぼしが足りないと あけられない", () => {
    const s = newSave();
    expect(openChest(s, mulberry32(1))).toBeNull();
    s.coins = 300;
    expect(openChest(s, mulberry32(1))).not.toBeNull();
    expect(s.coins).toBe(0);
  });
});

describe("セーブ", () => {
  it("こわれたデータでも 動く形になる", () => {
    const s = normalize({ coins: "x", items: [{ uid: 5, id: "nai" }, { uid: 6, id: "hone", r: 9, lv: 99 }], equipped: { weapon: 5, collar: 6 } });
    expect(s.coins).toBe(0);
    expect(s.items).toEqual([{ uid: 6, id: "hone", r: 3, lv: 40 }]);
    expect(s.equipped).toEqual({});
    expect(s.nextUid).toBe(7);
  });
  it("章をクリアすると 次の章へ行ける", () => {
    const s = newSave();
    const rw = finishRun(s, { chapter: 1, stage: 10, won: true, coins: 123.4, drops: [item(0, "suzu", 1)] });
    expect(rw.unlocked).toBe(2);
    expect(s.best[1]).toBe(10);
    expect(s.coins).toBe(123);
    expect(s.items.at(-1)?.uid).toBe(3);
    equipItem(s, 3);
    expect(s.equipped.collar).toBe(3);
  });
  it("やられたら とどいたステージの1つ前までが記録", () => {
    const s = newSave();
    finishRun(s, { chapter: 1, stage: 6, won: false, coins: 0, drops: [] });
    expect(s.best[1]).toBe(5);
    expect(s.unlocked).toBe(1);
  });
});

describe("スキル・ステージ", () => {
  it("3つの選択肢は ちがうもので、上限のものは出ない", () => {
    const owned = Object.fromEntries(SKILLS.filter((x) => x.id !== "atk" && x.id !== "aspd").map((x) => [x.id, x.max]));
    const r = rollSkills(owned, mulberry32(1), 3, { hurt: true });
    expect(new Set(r).size).toBe(r.length);
    expect(r.sort()).toEqual(["aspd", "atk", "heal"].filter((x) => x !== "heal" || (owned.heal ?? 0) < 99).sort());
  });
  it("章が進むと 敵が かたくなる", () => {
    expect(stageInfo(2, 1).hpMul).toBeGreaterThan(stageInfo(1, 10).hpMul);
    expect(stageInfo(1, 5).boss).toBe(true);
    expect(stageInfo(1, 10).boss).toBe(true);
  });
});
