// ガチャ「飼い主のおみやげ」: チュールで回す。武器・防具・アクセサリーが出る。
// シリーズ装備（季節の衣装）は ここでしか出ない。50回 出なければ 次は かならず シリーズ。
import { ITEMS, NORMAL_ITEMS, type Item, type Rarity } from "./equip";
import { weighted, type Rng } from "./rng";
import type { SaveData } from "./save";

export const GACHA_COST = 30;
export const GACHA10_COST = 270;
export const GACHA_PITY = 50;
/** シリーズ装備が出る確率 */
export const SERIES_RATE = 0.03;
/** シリーズ装備の 品質 */
export const SERIES_RARITY: Rarity = 3;
/** ふつうの装備の 品質の 出やすさ */
export const NORMAL_RATES: readonly (readonly [Rarity, number])[] = [[0, 0.55], [1, 0.3], [2, 0.12], [3, 0.03]];

const SERIES_ITEMS = ITEMS.filter((d) => d.series);

export interface GachaPull { item: Item; series: boolean; pity: boolean }

export function canPull(save: SaveData, count: 1 | 10): boolean {
  return save.churu >= (count === 10 ? GACHA10_COST : GACHA_COST);
}

export function pullGacha(save: SaveData, rng: Rng, count: 1 | 10): GachaPull[] | null {
  if (!canPull(save, count)) return null;
  save.churu -= count === 10 ? GACHA10_COST : GACHA_COST;
  const out: GachaPull[] = [];
  for (let i = 0; i < count; i++) {
    const pity = save.gachaPity + 1 >= GACHA_PITY;
    const series = pity || rng() < SERIES_RATE;
    save.gachaPity = series ? 0 : save.gachaPity + 1;
    const def = series ? SERIES_ITEMS[Math.floor(rng() * SERIES_ITEMS.length)] : NORMAL_ITEMS[Math.floor(rng() * NORMAL_ITEMS.length)];
    const item: Item = { uid: save.nextUid++, id: def.id, r: series ? SERIES_RARITY : weighted(rng, NORMAL_RATES), lv: 1 };
    save.items.push(item);
    out.push({ item, series, pity: pity && series });
  }
  return out;
}
