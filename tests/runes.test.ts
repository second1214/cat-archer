import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/core/rng";
import { equipRune, mergeAllRunes, mergeRune, openChest, runePartners } from "../src/core/run";
import { G, MAX_GRADE, runeBase, runeEffects, type Rune, type RuneId } from "../src/core/runes";
import { etchedSlotsOpen, loadoutOf, newSave, normalize } from "../src/core/save";
import { rollSkills, STRIKE_SUPPORT } from "../src/core/skills";

const ru = (uid: number, id: RuneId, g: number): Rune => ({ uid, id, g });
const eff = (id: RuneId, g: number) => runeEffects([ru(1, id, g)]);

describe("ルーン: 合成", () => {
  it("同じルーン・同じ品質 2つで 1段上がる", () => {
    const s = newSave();
    s.runes = [ru(1, "dragon", 0), ru(2, "dragon", 0), ru(3, "dragon", 1)];
    expect(mergeRune(s, 1)?.g).toBe(1);
    expect(s.runes.map((r) => r.uid)).toEqual([1, 3]);
    expect(runePartners(s, s.runes[0])?.map((r) => r.uid)).toEqual([3]);
  });
  it("ちがうルーン・ちがう品質・付けているものは 材料にならない。ミシックは 上がらない", () => {
    const s = newSave();
    s.runes = [ru(1, "dragon", 0), ru(2, "ricochet", 0), ru(3, "dragon", 1), ru(4, "timeSword", MAX_GRADE), ru(5, "timeSword", MAX_GRADE)];
    expect(runePartners(s, s.runes[0])).toBeNull();
    expect(runePartners(s, s.runes[3])).toBeNull();
    s.runes.push(ru(6, "dragon", 0));
    s.runeSlots.enhancement[0] = 6;
    expect(runePartners(s, s.runes[0])).toBeNull();
  });
  it("まとめて合成: コモン4つ → エピック…ではなく レア1つ（2→1, 2→1, 2→1）", () => {
    const s = newSave();
    s.runes = [0, 1, 2, 3].map((i) => ru(i + 1, "potion", 0));
    mergeAllRunes(s);
    expect(s.runes).toHaveLength(1);
    expect(s.runes[0].g).toBe(G.rare);
  });
});

describe("ルーン: 品質ごとの効果（仕様の数値）", () => {
  it("ボス猫の気配（ドラゴンストライク）: エピック35% → レジェンド70% → ミシック100%", () => {
    expect(eff("dragon", G.rare).dragonChance).toBe(0);
    expect(eff("dragon", G.epic).dragonChance).toBe(0.35);
    expect(eff("dragon", G.epic2).dragonChance).toBe(0.35);
    expect(eff("dragon", G.legend).dragonChance).toBe(0.7);
    expect(eff("dragon", G.legend3).dragonChance).toBe(0.7);
    expect(eff("dragon", G.mythic).dragonChance).toBe(1);
  });
  it("ねこリレー（ストライク跳ね返り）: 35% → 70% → 必ず", () => {
    expect([G.epic, G.legend, G.mythic].map((g) => eff("ricochet", g).ricochetChance)).toEqual([0.35, 0.7, 1]);
  });
  it("時計ねこ（時の剣）: 3秒 → 1.5秒 → 50%で2匹", () => {
    expect(eff("timeSword", G.rare).timeSword).toBeNull();
    expect(eff("timeSword", G.epic).timeSword).toEqual({ interval: 3, doubleChance: 0 });
    expect(eff("timeSword", G.legend).timeSword).toEqual({ interval: 1.5, doubleChance: 0 });
    expect(eff("timeSword", G.mythic).timeSword).toEqual({ interval: 1.5, doubleChance: 0.5 });
  });
  it("またたびの小袋（ストライクのポーション）: エピックで はじめから持つ", () => {
    expect(eff("potion", G.rare).potion.start).toBe(false);
    expect(eff("potion", G.epic).potion.start).toBe(true);
    expect(eff("potion", G.legend).potion.extraOnPickup).toBe(3);
    expect(eff("potion", G.mythic).potion.doubleChance).toBe(0.5);
  });
  it("子ねこ連れ（ストライク分裂）・ねこの集会所（ストライクの巣）", () => {
    expect(eff("split", G.epic).split).toEqual({ chance: 0.5, count: 3, homing: false });
    expect(eff("split", G.legend).split).toEqual({ chance: 0.5, count: 5, homing: true });
    expect(eff("aerie", G.epic).aerieChance).toBe(0.25);
    expect(eff("aerie", G.legend).aerieChance).toBe(0.5);
    expect(eff("aerie", G.rare).strikeSkillWeight).toBe(1.5);
    expect(eff("aerie", G.legend3).strikeSkillWeight).toBe(2);
  });
  it("基本の力は 本家の1/10（強化: 攻撃力 2〜150、能力: 体力 8〜600）", () => {
    expect(runeBase(ru(1, "dragon", 0)).atk).toBe(2);
    expect(runeBase(ru(1, "dragon", MAX_GRADE)).atk).toBe(150);
    expect(runeBase(ru(1, "timeSword", MAX_GRADE)).hp).toBe(600);
    expect(runeBase(ru(1, "split", G.rare))).toEqual({ atk: 18, hp: 72 });
  });
});

describe("ルーン: 枠", () => {
  it("銘刻の枠は ほかのルーンが ぜんぶ エピックで1つ・レジェンドで2つ・レジェンド+2で3つ", () => {
    const s = newSave();
    s.runes = [ru(1, "dragon", G.epic), ru(2, "timeSword", G.rare), ru(3, "split", G.rare)];
    expect(equipRune(s, 1)).toBe(true);
    expect(equipRune(s, 2)).toBe(true);
    expect(etchedSlotsOpen(s)).toBe(0);
    expect(equipRune(s, 3)).toBe(false);
    s.runes[1].g = G.epic;
    expect(etchedSlotsOpen(s)).toBe(1);
    expect(equipRune(s, 3)).toBe(true);
    s.runes[0].g = G.legend; s.runes[1].g = G.legend;
    expect(etchedSlotsOpen(s)).toBe(2);
    s.runes[0].g = G.legend2; s.runes[1].g = G.legend2;
    expect(etchedSlotsOpen(s)).toBe(3);
  });
  it("付けたルーンの 攻撃力・体力が 力に入る", () => {
    const s = newSave();
    const a = loadoutOf(s);
    s.runes = [ru(1, "dragon", G.rare)];
    equipRune(s, 1);
    const b = loadoutOf(s);
    expect(b.atk - a.atk).toBeCloseTo(6 + 5, 5); // 基本 +6、レアの +5
    expect(b.rune.strikeDmg).toBe(1.5);
  });
  it("セーブ: 祝福・銘刻は レアより下にならない、種類のちがう枠には入らない", () => {
    const s = normalize({ runes: [{ uid: 5, id: "split", g: 0 }, { uid: 6, id: "dragon", g: 3 }], runeSlots: { ability: [6], enhancement: [6] } });
    expect(s.runes[0].g).toBe(G.rare);
    expect(s.runeSlots.ability).toEqual([null, null, null, null]);
    expect(s.runeSlots.enhancement[0]).toBe(6);
  });
  it("宝箱: 5章が開くと ときどき ルーン", () => {
    const s = newSave(); s.unlocked = 5;
    let got = 0;
    for (let i = 0; i < 200; i++) { s.coins = 300; const x = openChest(s, mulberry32(i)); if (x && "g" in x) got++; }
    expect(got).toBeGreaterThan(20);
    expect(got).toBeLessThan(70);
  });
});

describe("助っ人ねこのスキルの 出かた", () => {
  it("ふたご・爪とぎ・おそろいは 呼ぶ手段が あるときだけ", () => {
    const seen = (opts: Parameters<typeof rollSkills>[3], owned = {}) => new Set(Array.from({ length: 400 }, (_, i) => rollSkills(owned, mulberry32(i), 3, opts)).flat());
    for (const id of STRIKE_SUPPORT) {
      expect(seen({}).has(id)).toBe(false);
      expect(seen({}, { s_instant: 1 }).has(id)).toBe(true);
      expect(seen({ strikeSource: true }).has(id)).toBe(true);
    }
  });
});

describe("祝福ルーン", () => {
  it("6種あり、ボス（10面）・宝箱から レアで出る", async () => {
    const { RUNES, rollRune } = await import("../src/core/runes");
    expect(RUNES.filter((r) => r.type === "blessing")).toHaveLength(6);
    const rng = mulberry32(2);
    const got = Array.from({ length: 2000 }, (_, i) => rollRune(rng, i, true)).filter((r) => RUNES.find((d) => d.id === r.id)!.type === "blessing");
    expect(got.length / 2000).toBeGreaterThan(0.15);
    expect(got.every((r) => r.g === G.rare)).toBe(true);
  });
  it("九つの命: ミシックなら やられても 1回 起き上がる", async () => {
    const { World } = await import("../src/game/world");
    const s = newSave(); s.runes = [ru(1, "revive", G.mythic)]; equipRune(s, 1);
    const w = new World(loadoutOf(s), 1, mulberry32(1));
    const hit = (w as unknown as { hurt(d: number): void });
    w.hero.hp = 1; w.hero.inv = 0; hit.hurt.call(w, 9999);
    expect(w.state).toBe("fight");
    expect(w.hero.hp).toBe(Math.round(w.hero.maxHp / 2));
    w.hero.inv = 0; w.hero.hp = 1; hit.hurt.call(w, 9999);
    expect(w.state).toBe("dead");
  });
  it("飼い主のひざ・ひなたぼっこ・どっしり・のら猫のなかま", async () => {
    const { World } = await import("../src/game/world");
    expect(eff("guardian", G.legend).guard).toBe(0.1);
    expect(eff("lucky", G.mythic).dodge).toBe(0.1);
    // 同じ品質の 祝福（基本の力は 同じ）と くらべる
    const with_ = (id: RuneId) => { const s = newSave(); s.runes = [ru(1, id, G.epic)]; equipRune(s, 1); return loadoutOf(s); };
    const lo = with_("sturdy"), other = with_("lucky");
    expect(lo.atk).toBeCloseTo(other.atk * 0.85, 5);
    expect(lo.hp).toBe(Math.round(other.hp * 1.2));
    const p = newSave(); p.runes = [ru(1, "pact", G.mythic)]; equipRune(p, 1);
    expect(new World(loadoutOf(p), 1, mulberry32(1)).devilCost).toBeCloseTo(0.1, 5);
  });
});

describe("ねこ修行（タレント）", () => {
  it("にぼしで 上がり、力に入る。最大30", async () => {
    const { trainTalent, TALENT_MAX, talentCost } = await import("../src/core/talents");
    const s = newSave(); s.coins = 1e9;
    const a = loadoutOf(s);
    expect(trainTalent(s, "atk")).toBe(true);
    expect(trainTalent(s, "hp")).toBe(true);
    const b = loadoutOf(s);
    expect(b.atk).toBeGreaterThan(a.atk);
    expect(b.hp).toBe(a.hp + 15);
    for (let i = 0; i < 40; i++) trainTalent(s, "crit");
    expect(s.talents.crit).toBe(TALENT_MAX);
    expect(talentCost(TALENT_MAX)).toBeNull();
    const poor = newSave(); poor.coins = 0;
    expect(trainTalent(poor, "atk")).toBe(false);
  });
});
