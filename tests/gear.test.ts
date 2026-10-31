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
    expect(mergeItem(s, 1)?.r).toBe(5); // ミシック
    expect(mergeItem(s, 1)).toBeNull();
    // ミシックから上は 同じ装備の レジェンド 2つ（または レジェンドの素材）で 1段
    s.items.push(it_(4, "keedama", 4), it_(5, "keedama", 4));
    expect(mergeItem(s, 1)?.r).toBe(6);
    s.materials[4] = 8;
    for (let i = 0; i < 4; i++) mergeItem(s, 1);
    expect(s.items[0].r).toBe(MAX_RARITY); // カオス
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
  it("ミシック+の 分解は 使った レジェンドの数だけ レジェンドの素材", () => {
    const s = newSave(); s.items = [it_(9, "vest", 7)]; s.equipped = {};
    expect(dismantleItem(s, 9)).toBe(true);
    expect(s.materials[4]).toBe(3 + 2 * 2);
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

describe("チュール（ふやした もらい方）・20章", () => {
  it("1日1回: 同じ日は 1回だけ", async () => {
    const { claimDaily, CHURU_DAILY } = await import("../src/core/run");
    const s = newSave(); const c = s.churu;
    expect(claimDaily(s, "2026-11-01")).toBe(CHURU_DAILY);
    expect(claimDaily(s, "2026-11-01")).toBe(0);
    expect(claimDaily(s, "2026-11-02")).toBe(CHURU_DAILY);
    expect(s.churu).toBe(c + CHURU_DAILY * 2);
  });
  it("ステージクリア・章クリアで チュール", async () => {
    const { CHURU_STAGE, CHURU_CHAPTER, CHURU_BOSS } = await import("../src/core/run");
    const w = new World(loadoutOf(newSave()), 1, mulberry32(1));
    for (let st = 1; st <= 10; st++) {
      for (const e of w.enemies) e.dead = true;
      w.step(1 / 60, { mx: 0, my: 0 });
      if (st < 10) w.startStage(st + 1);
    }
    expect(w.state).toBe("won");
    expect(w.churu).toBeGreaterThanOrEqual(CHURU_STAGE * 10 + CHURU_CHAPTER);
    expect(CHURU_BOSS).toBeGreaterThan(0);
  });
  it("ガチャは 1回 3", () => {
    const s = newSave(); s.churu = 3;
    expect(pullGacha(s, mulberry32(1), 1)).toHaveLength(1);
    expect(s.churu).toBe(0);
  });
  it("50章まで。11章からは ゆっくり 強くなる", async () => {
    const { CHAPTERS } = await import("../src/core/save");
    const { chapterHp, CHAPTER_NAMES } = await import("../src/core/stages");
    expect(CHAPTERS).toBe(50);
    expect(CHAPTER_NAMES).toHaveLength(50);
    expect(new Set(CHAPTER_NAMES).size).toBe(50);
    expect(chapterHp(11) / chapterHp(10)).toBeLessThan(chapterHp(10) / chapterHp(9));
    expect(chapterHp(20)).toBeGreaterThan(chapterHp(10) * 3);
  });
});

describe("鍵・できごと・強い虫", () => {
  it("鍵: 合成の材料・分解に 使われない", async () => {
    const { toggleLock } = await import("../src/core/run");
    const s = newSave();
    s.items = [it_(1, "keedama"), it_(2, "keedama"), it_(3, "keedama")];
    s.equipped = {};
    expect(toggleLock(s, 2)).toBe(true);
    expect(dismantleItem(s, 2)).toBe(false);
    expect(mergeItem(s, 1)).toBeNull();
    toggleLock(s, 2);
    expect(mergeItem(s, 1)?.r).toBe(1);
  });
  it("3面のあとに 飼い主のごほうび、5面（ボス）のあとに のら猫ボス", async () => {
    const { DEVIL_COST } = await import("../src/game/world");
    const w = new World(loadoutOf(newSave()), 1, mulberry32(4));
    const clear = () => { for (const e of w.enemies) e.dead = true; w.step(1 / 60, { mx: 0, my: 0 }); };
    w.startStage(3); clear();
    expect(w.event?.kind).toBe("angel");
    expect(w.paused).toBe(true);
    w.hero.hp = 1; w.chooseEvent("heal");
    expect(w.hero.hp).toBeGreaterThan(1);
    expect(w.event).toBeNull();
    w.startStage(5); clear();
    expect(w.event?.kind).toBe("devil");
    const sk = w.event!.skills[0], max = w.hero.maxHp;
    w.chooseEvent(sk);
    expect(w.n(sk)).toBeGreaterThan(0);
    expect(w.hero.maxHp).toBeLessThan(max * (1 - DEVIL_COST) * 1.25 + 1);
  });
  it("2章から 後半のステージに 強い虫（体力3倍）", () => {
    let elites = 0;
    for (let sd = 1; sd <= 30; sd++) {
      const w = new World(loadoutOf(newSave()), 4, mulberry32(sd));
      for (const st of [6, 7, 8, 9]) { w.startStage(st); elites += w.enemies.filter((e) => e.elite).length; }
    }
    expect(elites).toBeGreaterThan(30);
    const w1 = new World(loadoutOf(newSave()), 1, mulberry32(1));
    w1.startStage(9);
    expect(w1.enemies.some((e) => e.elite)).toBe(false);
  });
});
