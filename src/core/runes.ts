// ルーン（ずっと残る強化装備）。5章で解放。祝福2・能力4・強化4・銘刻3 の枠に付ける。
// 同じルーン・同じ品質を 2つ合わせると 品質が1段上がる（コモン → … → ミシック）。
// 数値は 本家（アーチャー伝説2）の 1/10。ストライク（近所の猫）に関わる 6種を入れている。
import { weighted, type Rng } from "./rng";

export type RuneType = "blessing" | "ability" | "enhancement" | "etched";
export const RUNE_TYPES: readonly RuneType[] = ["blessing", "ability", "enhancement", "etched"];
export const RUNE_TYPE_NAMES: Record<RuneType, string> = { blessing: "祝福", ability: "能力", enhancement: "強化", etched: "銘刻" };
export const RUNE_SLOTS: Record<RuneType, number> = { blessing: 2, ability: 4, enhancement: 4, etched: 3 };

/** 品質（0 コモン 〜 10 ミシック） */
export const GRADE_NAMES = ["コモン", "グレート", "レア", "エピック", "エピック+1", "エピック+2", "レジェンド", "レジェンド+1", "レジェンド+2", "レジェンド+3", "ミシック"] as const;
export const G = { common: 0, great: 1, rare: 2, epic: 3, epic1: 4, epic2: 5, legend: 6, legend1: 7, legend2: 8, legend3: 9, mythic: 10 } as const;
export const MAX_GRADE = 10;
/** 合成に使う数（自分を入れて） */
export const RUNE_MERGE_COUNT = 2;
/** 解放される章 */
export const RUNE_UNLOCK_CHAPTER = 5;

/** 種類ごとの 基本の力（品質ごと）。祝福・銘刻は レアから */
const BASE: Record<RuneType, readonly ({ atk: number; hp: number } | null)[]> = {
  enhancement: [2, 4, 6, 8, 12, 20, 40, 70, 95, 120, 150].map((atk) => ({ atk, hp: 0 })),
  ability: [8, 16, 24, 32, 48, 80, 160, 280, 380, 480, 600].map((hp) => ({ atk: 0, hp })),
  blessing: [null, null, ...[[3.6, 14.4], [4.8, 19.2], [7.2, 28.8], [8.6, 38.4], [24, 96], [42, 168], [57, 228], [72, 288], [90, 360]].map(([atk, hp]) => ({ atk, hp }))],
  etched: [null, null, ...[[18, 72], [24, 96], [36, 144], [60, 240], [120, 480], [210, 840], [285, 1140], [360, 1440], [450, 1800]].map(([atk, hp]) => ({ atk, hp }))],
};

/** 品質ごとに 足される効果（その品質以上で ずっと効く） */
export interface RuneStep {
  at: number;
  desc: string;
  atk?: number;
  hp?: number;
  strikeDmg?: number;
}

export type RuneId = "dragon" | "ricochet" | "timeSword" | "potion" | "split" | "aerie";

export interface RuneDef {
  id: RuneId;
  type: RuneType;
  name: string;
  icon: string;
  steps: RuneStep[];
}

export const RUNES: readonly RuneDef[] = [
  { id: "dragon", type: "enhancement", name: "ボス猫の気配", icon: "👑", steps: [
    { at: G.common, desc: "助っ人ねこのダメージ +0.5", strikeDmg: 0.5 },
    { at: G.great, desc: "助っ人ねこのダメージ +1", strikeDmg: 1 },
    { at: G.rare, desc: "攻撃力 +5", atk: 5 },
    { at: G.epic, desc: "助っ人ねこが 35%で ボス猫になる（攻撃力×1.0）" },
    { at: G.legend, desc: "ボス猫になる確率 70%" },
    { at: G.mythic, desc: "ボス猫になる確率 100%" },
  ] },
  { id: "ricochet", type: "enhancement", name: "ねこリレー", icon: "🔁", steps: [
    { at: G.common, desc: "助っ人ねこのダメージ +0.5", strikeDmg: 0.5 },
    { at: G.great, desc: "助っ人ねこのダメージ +1", strikeDmg: 1 },
    { at: G.rare, desc: "攻撃力 +5", atk: 5 },
    { at: G.epic, desc: "助っ人ねこが 35%で 次の敵へ跳ね返る" },
    { at: G.legend, desc: "跳ね返る確率 70%" },
    { at: G.mythic, desc: "かならず跳ね返る" },
  ] },
  { id: "timeSword", type: "ability", name: "時計ねこ", icon: "⏰", steps: [
    { at: G.common, desc: "助っ人ねこのダメージ +0.5", strikeDmg: 0.5 },
    { at: G.great, desc: "助っ人ねこのダメージ +1", strikeDmg: 1 },
    { at: G.rare, desc: "最大体力 +20", hp: 20 },
    { at: G.epic, desc: "3秒ごとに 助っ人ねこが1匹来る" },
    { at: G.legend, desc: "1.5秒ごとに来る" },
    { at: G.mythic, desc: "50%で 2匹来る" },
  ] },
  { id: "potion", type: "ability", name: "またたびの小袋", icon: "🌿", steps: [
    { at: G.common, desc: "助っ人ねこのダメージ +0.5", strikeDmg: 0.5 },
    { at: G.great, desc: "助っ人ねこのダメージ +1", strikeDmg: 1 },
    { at: G.rare, desc: "最大体力 +20", hp: 20 },
    { at: G.epic, desc: "はじめから「またたび」を持っている（ときどき 床に またたびが出て、拾うと 助っ人ねこ5匹）" },
    { at: G.legend, desc: "またたびを拾うと 助っ人ねこが さらに3匹" },
    { at: G.mythic, desc: "またたびの 助っ人ねこが 50%で 2倍" },
  ] },
  { id: "split", type: "etched", name: "子ねこ連れ", icon: "🐾", steps: [
    { at: G.rare, desc: "助っ人ねこのスキルが 出やすい" },
    { at: G.epic, desc: "助っ人ねこが 帰るとき、50%で 子ねこ3匹に分かれる（ダメージ33%ずつ）" },
    { at: G.legend, desc: "子ねこ5匹に分かれ、子ねこは 敵を追いかける" },
    { at: G.legend3, desc: "助っ人ねこのスキルが とても出やすい" },
    { at: G.mythic, desc: "体力50%未満の敵へ 助っ人ねこのダメージ +20%" },
  ] },
  { id: "aerie", type: "etched", name: "ねこの集会所", icon: "🏠", steps: [
    { at: G.rare, desc: "助っ人ねこのスキルが 出やすい" },
    { at: G.epic, desc: "助っ人ねこが当たると 25%で 子ねこが1匹 加わる（ダメージ半分）" },
    { at: G.legend, desc: "子ねこが加わる確率 50%" },
    { at: G.legend3, desc: "助っ人ねこのスキルが とても出やすい" },
  ] },
];

export const RUNE_MAP = Object.fromEntries(RUNES.map((r) => [r.id, r])) as Record<RuneId, RuneDef>;

export interface Rune { uid: number; id: RuneId; g: number }

export const minGrade = (t: RuneType) => (t === "blessing" || t === "etched" ? G.rare : G.common);

export function runeBase(r: Rune): { atk: number; hp: number } {
  return BASE[RUNE_MAP[r.id].type][r.g] ?? { atk: 0, hp: 0 };
}

export const activeSteps = (r: Rune): RuneStep[] => RUNE_MAP[r.id].steps.filter((s) => r.g >= s.at);

/** 付けているルーンの効果（戦闘で使う形） */
export interface RuneEffects {
  atk: number;
  hp: number;
  strikeDmg: number;
  dragonChance: number;
  ricochetChance: number;
  timeSword: { interval: number; doubleChance: number } | null;
  potion: { start: boolean; extraOnPickup: number; doubleChance: number };
  split: { chance: number; count: number; homing: boolean } | null;
  aerieChance: number;
  /** 助っ人ねこのスキルが 3択に出る 重みの倍率 */
  strikeSkillWeight: number;
  /** 体力50%未満の敵への 助っ人ねこのダメージ +% */
  lowHpBonus: number;
}

export function runeEffects(runes: readonly Rune[]): RuneEffects {
  const e: RuneEffects = {
    atk: 0, hp: 0, strikeDmg: 0, dragonChance: 0, ricochetChance: 0, timeSword: null,
    potion: { start: false, extraOnPickup: 0, doubleChance: 0 }, split: null, aerieChance: 0, strikeSkillWeight: 1, lowHpBonus: 0,
  };
  for (const r of runes) {
    const b = runeBase(r);
    e.atk += b.atk; e.hp += b.hp;
    for (const s of activeSteps(r)) { e.atk += s.atk ?? 0; e.hp += s.hp ?? 0; e.strikeDmg += s.strikeDmg ?? 0; }
    const g = r.g;
    switch (r.id) {
      case "dragon": e.dragonChance = Math.max(e.dragonChance, g >= G.mythic ? 1 : g >= G.legend ? 0.7 : g >= G.epic ? 0.35 : 0); break;
      case "ricochet": e.ricochetChance = Math.max(e.ricochetChance, g >= G.mythic ? 1 : g >= G.legend ? 0.7 : g >= G.epic ? 0.35 : 0); break;
      case "timeSword":
        if (g >= G.epic) e.timeSword = { interval: g >= G.legend ? 1.5 : 3, doubleChance: g >= G.mythic ? 0.5 : 0 };
        break;
      case "potion":
        if (g >= G.epic) e.potion.start = true;
        if (g >= G.legend) e.potion.extraOnPickup = 3;
        if (g >= G.mythic) e.potion.doubleChance = 0.5;
        break;
      case "split":
        if (g >= G.epic) e.split = { chance: 0.5, count: g >= G.legend ? 5 : 3, homing: g >= G.legend };
        if (g >= G.mythic) e.lowHpBonus = 0.2;
        break;
      case "aerie":
        e.aerieChance = Math.max(e.aerieChance, g >= G.legend ? 0.5 : g >= G.epic ? 0.25 : 0);
        break;
    }
    if (RUNE_MAP[r.id].type === "etched") e.strikeSkillWeight = Math.max(e.strikeSkillWeight, g >= G.legend3 ? 2 : g >= G.rare ? 1.5 : 1);
  }
  return e;
}

/** ルーンが落ちる（強化・能力は コモンかグレート。銘刻は ボス10面で 10%、レア） */
export function rollRune(rng: Rng, uid: number, bigBoss: boolean): Rune {
  if (bigBoss && rng() < 0.1) {
    const etched = RUNES.filter((r) => r.type === "etched");
    return { uid, id: etched[Math.floor(rng() * etched.length)].id, g: G.rare };
  }
  const pool = RUNES.filter((r) => r.type === "ability" || r.type === "enhancement");
  return { uid, id: pool[Math.floor(rng() * pool.length)].id, g: weighted(rng, [[G.common, 0.75], [G.great, 0.25]]) };
}
