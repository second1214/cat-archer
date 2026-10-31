// 神鍛（本家の Godforge）。Archero2Hub の 表どおり（数は 1/10）:
// ミシック+3 以上の シリーズ装備だけ。★1 攻撃力 +10%・★2 体力 +10%・★3 攻撃力 +10%・★4 体力 +10%・★5 降臨。
// 材料: 装備エッセンス（ふつうの装備を 分解: コモン1・グレート3・レア9・エピック27）＋ シリーズの 結晶（カオスの シリーズ装備を 分解・そのシリーズだけに使える）＋ ★5 は 神鍛の核。
// 降臨: 武器が ★5 のときだけ。攻撃が 当たると たまり、10で 10秒 降臨。ほかの部位の ★5（同じシリーズ）が 降臨中の 効果を 足す。
import { ITEM_MAP, MAX_RARITY, type Item, type SeriesId, type Slot } from "./equip";
import type { SaveData } from "./save";

export const GF_MIN_RARITY = 8; // ミシック+3
export const GF_MAX = 5;
/** ★n → ★n+1 の 材料 */
export const GF_COST: readonly { essence: number; crystals: number; cores: number }[] = [
  { essence: 200, crystals: 5, cores: 0 },
  { essence: 300, crystals: 10, cores: 0 },
  { essence: 400, crystals: 10, cores: 0 },
  { essence: 500, crystals: 15, cores: 0 },
  { essence: 600, crystals: 0, cores: 16 },
];
/** 分解で 出る エッセンス（コモン〜エピック。それより上は エピックと同じ） */
export const ESSENCE_BY_RARITY = [1, 3, 9, 27] as const;
export const essenceOf = (r: number) => ESSENCE_BY_RARITY[Math.min(3, r)];
/** カオスの シリーズ装備を 分解すると 結晶 */
export const CRYSTALS_PER_CHAOS = 10;

export const GF_STEP_DESC = ["攻撃力 +10%", "最大体力 +10%", "攻撃力 +10%", "最大体力 +10%", "降臨"] as const;

export function canGodforge(it: Item): boolean {
  return !!ITEM_MAP[it.id]?.series && it.r >= GF_MIN_RARITY && (it.gf ?? 0) < GF_MAX;
}
export function gfCost(it: Item) { return GF_COST[it.gf ?? 0] ?? null; }
export function gfAffordable(save: SaveData, it: Item): boolean {
  const c = gfCost(it), s = ITEM_MAP[it.id]?.series;
  return !!c && !!s && canGodforge(it) && save.essence >= c.essence && (save.crystals[s] ?? 0) >= c.crystals && save.cores >= c.cores;
}
export function godforge(save: SaveData, uid: number): boolean {
  const it = save.items.find((x) => x.uid === uid);
  if (!it || !gfAffordable(save, it)) return false;
  const c = gfCost(it)!, s = ITEM_MAP[it.id].series!;
  save.essence -= c.essence; save.crystals[s] = (save.crystals[s] ?? 0) - c.crystals; save.cores -= c.cores;
  it.gf = (it.gf ?? 0) + 1;
  return true;
}
/** 装備ごとの 攻撃力・体力 +% */
export function gfStats(it: Item): { atkPct: number; hpPct: number } {
  const g = it.gf ?? 0;
  return { atkPct: (g >= 1 ? 0.1 : 0) + (g >= 3 ? 0.1 : 0), hpPct: (g >= 2 ? 0.1 : 0) + (g >= 4 ? 0.1 : 0) };
}
/** 分解したときの 神鍛の材料 */
export function dismantleGf(save: SaveData, it: Item): void {
  const s = ITEM_MAP[it.id]?.series;
  if (s && it.r >= MAX_RARITY) save.crystals[s] = (save.crystals[s] ?? 0) + CRYSTALS_PER_CHAOS;
  else save.essence += essenceOf(it.r);
}

/** 降臨（戦いで使う形）。武器が ★5 でなければ null */
export interface Descent {
  series: SeriesId;
  /** 何に 当たると たまるか */
  family: "main" | "strike" | "orbit";
  duration: number;
  /** 降臨中: その系統の ダメージ +%（本家の資料に 数値が ないので 決めた） */
  famDmg: number;
  /** 降臨中: 会心ダメージ +%（帽子） */
  critDmg: number;
  /** 降臨に はいると 無敵の秒数（服） */
  shield: number;
  /** 降臨中: 2秒ごとに 回復（体力の上限の %。首輪） */
  heal: number;
}
export const DESCENT_NAMES: Record<SeriesId, string> = { halloween: "ハロウィンの夜", newyear: "初夢", christmas: "聖夜" };
const FAMILY: Record<SeriesId, Descent["family"]> = { halloween: "main", newyear: "strike", christmas: "orbit" };
export const DESCENT_SLOT_DESC: Record<Slot, string> = {
  weapon: "攻撃が 当たると ときどき たまり、10で 10秒「降臨」（その系統の ダメージ +30%）",
  charm: "降臨の 時間 +5秒",
  hat: "降臨中 会心ダメージ +60%",
  clothes: "降臨に はいると 2秒 無敵",
  collar: "降臨中 2秒ごとに 体力の上限の 3% 回復",
};

export function descentOf(worn: readonly Item[]): Descent | null {
  const w = worn.find((it) => ITEM_MAP[it.id].slot === "weapon");
  const s = w && ITEM_MAP[w.id].series;
  if (!w || !s || (w.gf ?? 0) < GF_MAX) return null;
  const lv5 = (slot: Slot) => worn.some((it) => ITEM_MAP[it.id].slot === slot && ITEM_MAP[it.id].series === s && (it.gf ?? 0) >= GF_MAX);
  return {
    series: s, family: FAMILY[s],
    duration: 10 + (lv5("charm") ? 5 : 0),
    famDmg: 0.3,
    critDmg: lv5("hat") ? 0.6 : 0,
    shield: lv5("clothes") ? 2 : 0,
    heal: lv5("collar") ? 0.03 : 0,
  };
}
