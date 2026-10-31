import { describe, expect, it } from "vitest";
import { ITEM_MAP, ITEMS, MAX_RARITY, rollItem, SERIES, setBonuses, type Item } from "../src/core/equip";
import { GACHA_COST, GACHA_PITY, pullGacha } from "../src/core/gacha";
import { mulberry32 } from "../src/core/rng";
import { dismantleItem, finishRun, mergeItem, CHURU_FIRST_CLEAR } from "../src/core/run";
import { loadoutOf, newSave, normalize } from "../src/core/save";
import { World } from "../src/game/world";

const it_ = (uid: number, id: string, r: Item["r"] = 0, lv = 1): Item => ({ uid, id, r, lv });

describe("装備: 6段・合成素材", () => {
  it("同じ装備3つで1段。ミシックが いちばん上", () => {
    const s = newSave();
    s.items = [it_(1, "keedama", 4), it_(2, "keedama", 4), it_(3, "keedama", 4)];
    s.equipped = { weapon: 1 };
    expect(mergeItem(s, 1)?.r).toBe(MAX_RARITY);
    expect(mergeItem(s, 1)).toBeNull();
  });
  it("分解すると 同じ品質の素材 1つ。素材は ほかの装備の 合成に使える", () => {
    const s = newSave();
    s.items = [it_(1, "keedama", 2), it_(2, "vest", 2), it_(3, "sakana", 2), it_(4, "suzu", 1)];
    s.equipped = {};
    expect(dismantleItem(s, 2)).toBe(true);
    expect(dismantleItem(s, 3)).toBe(true);
    expect(s.materials[2]).toBe(2);
    expect(mergeItem(s, 1)?.r).toBe(3);
    expect(s.materials[2]).toBe(0);
    // 品質がちがう素材は 使えない
    s.materials[0] = 5;
    expect(mergeItem(s, 4)).toBeNull();
  });
  it("付けている装備は 分解できない", () => {
    const s = newSave();
    expect(dismantleItem(s, 1)).toBe(false);
  });
  it("古いセーブ（4段）は 6段に 読みかえる", () => {
    const s = normalize({ version: 1, items: [{ uid: 1, id: "keedama", r: 0 }, { uid: 2, id: "keedama", r: 1 }, { uid: 3, id: "keedama", r: 2 }, { uid: 4, id: "keedama", r: 3 }] });
    expect(s.items.map((x) => x.r)).toEqual([0, 2, 3, 4]);
    expect(s.churu).toBeGreaterThan(0);
  });
  it("宝箱・ドロップには シリーズ装備は 出ない", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 500; i++) expect(ITEM_MAP[rollItem(rng, i, 0).id].series).toBeUndefined();
  });
  it("どの装備にも ミシックの特性がある", () => {
    for (const d of ITEMS) expect(d.traits.some((t) => t.at === 5)).toBe(true);
  });
});

describe("ガチャ（飼い主のおみやげ）", () => {
  it("チュールが へって 装備がふえる。足りなければ 回せない", () => {
    const s = newSave(); s.churu = GACHA_COST;
    const n = s.items.length;
    expect(pullGacha(s, mulberry32(1), 1)).toHaveLength(1);
    expect(s.churu).toBe(0);
    expect(s.items.length).toBe(n + 1);
    expect(pullGacha(s, mulberry32(1), 1)).toBeNull();
  });
  it(`${GACHA_PITY}回 シリーズが出なければ 次は かならず`, () => {
    const s = newSave(); s.churu = 1e9;
    const never = () => 0.999; // シリーズの 抽選に ずっと はずれる
    const res = Array.from({ length: GACHA_PITY }, () => pullGacha(s, never, 1)![0]);
    expect(res.slice(0, -1).every((r) => !r.series)).toBe(true);
    expect(res[GACHA_PITY - 1].series).toBe(true);
    expect(s.gachaPity).toBe(0);
  });
  it("シリーズは ガチャで 出る（だいたい 3%）", () => {
    const s = newSave(); s.churu = 1e9;
    let n = 0;
    const rng = mulberry32(9);
    for (let i = 0; i < 300; i++) n += pullGacha(s, rng, 10)!.filter((r) => r.series).length;
    expect(n / 3000).toBeGreaterThan(0.025);
    expect(n / 3000).toBeLessThan(0.06);
  });
});

describe("シリーズの 特色・セット効果", () => {
  const wear = (series: string, n: number) => {
    const s = newSave();
    const parts = ITEMS.filter((d) => d.series === series).slice(0, n);
    s.items = parts.map((d, i) => it_(10 + i, d.id, 3));
    s.equipped = Object.fromEntries(parts.map((d, i) => [d.slot, 10 + i]));
    return s;
  };
  it("どのシリーズも 5部位", () => {
    for (const sr of SERIES) expect(new Set(ITEMS.filter((d) => d.series === sr.id).map((d) => d.slot)).size).toBe(5);
  });
  it("ハロウィン: レーザー。4つで 武器がレーザー・壁ではねる", () => {
    const lo = loadoutOf(wear("halloween", 4));
    expect(lo.laser).toBe(true);
    expect(lo.stats.laserPct).toBeGreaterThan(0.5);
    expect(lo.bounce).toBeGreaterThanOrEqual(1);
  });
  it("お正月: 助っ人ねこ。4つで はじめから 助っ人ねこ", () => {
    const lo = loadoutOf(wear("newyear", 4));
    expect(lo.stats.strikePct).toBeGreaterThan(0.25);
    expect(lo.startSkills).toContain("s_instant");
    const w = new World(lo, 1, mulberry32(1));
    expect(w.n("s_instant")).toBe(1);
  });
  it("クリスマス: まわる玉。4つで はじめから まわる毛糸＋1", () => {
    const lo = loadoutOf(wear("christmas", 4));
    const w = new World(lo, 1, mulberry32(1));
    expect(w.orbs).toBe(2 + 1);
    expect(lo.stats.orbitPct).toBeGreaterThan(0.3);
    expect(setBonuses(wear("christmas", 1).items)[0].traits).toHaveLength(0);
  });
});

describe("チュール", () => {
  it("章を はじめてクリアすると もらえる（2回目は もらえない）", () => {
    const s = newSave(); const c = s.churu;
    finishRun(s, { chapter: 1, stage: 10, won: true, coins: 0, drops: [], churu: 20 });
    expect(s.churu).toBe(c + 20 + CHURU_FIRST_CLEAR);
    finishRun(s, { chapter: 1, stage: 10, won: true, coins: 0, drops: [], churu: 0 });
    expect(s.churu).toBe(c + 20 + CHURU_FIRST_CLEAR);
  });
});
