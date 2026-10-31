// 装備（ずっと残る強さ）。3つの枠・4つのレア度。同じ装備・同じレア度を3つ合わせると 1つ上のレア度になる。
import { weighted, type Rng } from "./rng";

export type Slot = "weapon" | "collar" | "charm";
export const SLOTS: readonly Slot[] = ["weapon", "collar", "charm"];
export const SLOT_NAMES: Record<Slot, string> = { weapon: "武器", collar: "首輪", charm: "お守り" };

/** 0 ふつう・1 レア・2 エピック・3 レジェンド */
export type Rarity = 0 | 1 | 2 | 3;
export const MAX_RARITY: Rarity = 3;
export const RARITY_NAMES = ["ふつう", "レア", "エピック", "レジェンド"] as const;
/** 力の倍率（レア度ごと） */
export const RARITY_MUL = [1, 1.7, 2.8, 4.5] as const;
/** 強化できる最大レベル（レア度ごと） */
export const MAX_LEVEL = [10, 20, 30, 40] as const;
/** 合成に使う数（自分を入れて） */
export const MERGE_COUNT = 3;

export interface Stats {
  atk: number;      // 攻撃力（足し算）
  hp: number;       // 体力（足し算）
  hpPct: number;    // 体力 +%
  atkPct: number;   // 攻撃力 +%
  aspd: number;     // 攻撃の速さ +%
  crit: number;     // 会心の出やすさ
  dodge: number;    // よける確率
  guard: number;    // 受けるダメージ -%
  coinPct: number;  // にぼし +%
}

export const emptyStats = (): Stats => ({ atk: 0, hp: 0, hpPct: 0, atkPct: 0, aspd: 0, crit: 0, dodge: 0, guard: 0, coinPct: 0 });

export interface Trait {
  /** このレア度から使える */
  at: Rarity;
  desc: string;
  stats?: Partial<Stats>;
  /** プレイのはじめから持っているスキルのような効果 */
  bounce?: number;
  pierce?: boolean;
  regen?: number; // ステージをクリアするたびに 体力の上限のこの割合 回復
}

export interface ItemDef {
  id: string;
  slot: Slot;
  name: string;
  icon: string;
  /** レベル・レア度で伸びる力（atk・hp は レベルでも伸びる） */
  base: Partial<Stats>;
  traits: Trait[];
}

export const ITEMS: readonly ItemDef[] = [
  { id: "keedama", slot: "weapon", name: "毛玉", icon: "🧶", base: { atk: 10 },
    traits: [{ at: 2, desc: "毛玉が壁で1回はねる", bounce: 1 }, { at: 3, desc: "攻撃力 +15%", stats: { atkPct: 0.15 } }] },
  { id: "hone", slot: "weapon", name: "魚の骨", icon: "🦴", base: { atk: 14, aspd: -0.15 },
    traits: [{ at: 2, desc: "毛玉が敵をつらぬく", pierce: true }, { at: 3, desc: "会心の出やすさ +10%", stats: { crit: 0.1 } }] },
  { id: "jarashi", slot: "weapon", name: "ねこじゃらし", icon: "🌾", base: { atk: 7, aspd: 0.2 },
    traits: [{ at: 2, desc: "攻撃の速さ +10%", stats: { aspd: 0.1 } }, { at: 3, desc: "攻撃力 +20%", stats: { atkPct: 0.2 } }] },
  { id: "akai", slot: "collar", name: "赤い首輪", icon: "❤️", base: { hp: 60 },
    traits: [{ at: 2, desc: "ステージをクリアすると 体力を10% 回復", regen: 0.1 }, { at: 3, desc: "体力 +20%", stats: { hpPct: 0.2 } }] },
  { id: "suzu", slot: "collar", name: "鈴の首輪", icon: "🔔", base: { hp: 40, dodge: 0.04 },
    traits: [{ at: 2, desc: "よける確率 +5%", stats: { dodge: 0.05 } }, { at: 3, desc: "攻撃の速さ +10%", stats: { aspd: 0.1 } }] },
  { id: "kawa", slot: "collar", name: "革の首輪", icon: "🟫", base: { hp: 50, guard: 0.05 },
    traits: [{ at: 2, desc: "受けるダメージ -5%", stats: { guard: 0.05 } }, { at: 3, desc: "受けるダメージ -8%", stats: { guard: 0.08 } }] },
  { id: "sakana", slot: "charm", name: "お魚のお守り", icon: "🐠", base: { atk: 4, atkPct: 0.05 },
    traits: [{ at: 2, desc: "攻撃力 +8%", stats: { atkPct: 0.08 } }, { at: 3, desc: "会心の出やすさ +8%", stats: { crit: 0.08 } }] },
  { id: "nikukyu", slot: "charm", name: "肉球のお守り", icon: "🐾", base: { crit: 0.05, hp: 20 },
    traits: [{ at: 2, desc: "会心の出やすさ +6%", stats: { crit: 0.06 } }, { at: 3, desc: "よける確率 +6%", stats: { dodge: 0.06 } }] },
  { id: "maneki", slot: "charm", name: "招き猫のお守り", icon: "🐈", base: { coinPct: 0.2, atk: 2 },
    traits: [{ at: 2, desc: "にぼし +20%", stats: { coinPct: 0.2 } }, { at: 3, desc: "攻撃力 +10%", stats: { atkPct: 0.1 } }] },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((d) => [d.id, d])) as Record<string, ItemDef>;

export interface Item {
  uid: number;
  id: string;
  r: Rarity;
  lv: number;
}

/** レベルで伸びるのは 攻撃力・体力だけ（% の力は レア度だけで伸びる）。 */
export function itemStats(it: Item): Stats {
  const d = ITEM_MAP[it.id];
  const s = emptyStats();
  if (!d) return s;
  const rm = RARITY_MUL[it.r];
  const lm = 1 + 0.1 * (it.lv - 1);
  for (const [k, v] of Object.entries(d.base) as [keyof Stats, number][]) {
    s[k] += k === "atk" || k === "hp" ? v * rm * lm : v < 0 ? v : v * (1 + 0.35 * it.r);
  }
  for (const t of d.traits) {
    if (it.r < t.at || !t.stats) continue;
    for (const [k, v] of Object.entries(t.stats) as [keyof Stats, number][]) s[k] += v;
  }
  return s;
}

/** 使えるようになった特性 */
export const activeTraits = (it: Item): Trait[] => (ITEM_MAP[it.id]?.traits ?? []).filter((t) => it.r >= t.at);

export function addStats(a: Stats, b: Stats): Stats {
  const o = { ...a };
  for (const k of Object.keys(o) as (keyof Stats)[]) o[k] += b[k];
  return o;
}

/** 強化の値段（にぼし）。最大なら null。 */
export function upgradeCost(it: Item): number | null {
  if (it.lv >= MAX_LEVEL[it.r]) return null;
  return Math.round(40 * it.lv * (1 + it.r * 0.6));
}

/** 合成の相手（同じ装備・同じレア度で、装備していないもの。レベルの低い順）。足りなければ null。 */
export function mergePartners(items: readonly Item[], base: Item, equipped: ReadonlySet<number>): Item[] | null {
  if (base.r >= MAX_RARITY) return null;
  const mates = items
    .filter((x) => x.uid !== base.uid && x.id === base.id && x.r === base.r && !equipped.has(x.uid))
    .sort((a, b) => a.lv - b.lv)
    .slice(0, MERGE_COUNT - 1);
  return mates.length === MERGE_COUNT - 1 ? mates : null;
}

/** 落ちる装備のレア度（ボスは良いものが出やすい・章が進むと少し良くなる）。 */
export function rollRarity(rng: Rng, chapter: number, boss: boolean): Rarity {
  const up = Math.min(0.15, (chapter - 1) * 0.02) + (boss ? 0.12 : 0);
  return weighted<Rarity>(rng, [[0, 0.72 - up * 2], [1, 0.24 + up], [2, 0.04 + up]]);
}

export function rollItem(rng: Rng, uid: number, r: Rarity): Item {
  const d = ITEMS[Math.floor(rng() * ITEMS.length)];
  return { uid, id: d.id, r, lv: 1 };
}
