// キャットタワー（本家の スカイタワー）: 1階ずつ のぼる。終わりは ない。はじめて とどいた階で ごほうび。
// 10階ごとに チェックポイント（そこから はじめられる）。5階ごとに ボス。
import { G } from "./runes";
import type { SaveData } from "./save";

export const TOWER_UNLOCK = 8;
/** 階の 強さ（章で いうと どれくらいか） */
export const towerChapter = (floor: number) => 2 + Math.ceil(floor / 2);
/** はじめられる階（10階ごと） */
export const towerStart = (best: number) => Math.floor(best / 10) * 10 + 1;

export interface TowerReward { churu: number; stones: number; coins: number; epicMats: number }

/** 階 f に はじめて とどいた（クリアした）ごほうび */
export function floorReward(f: number): TowerReward {
  return {
    stones: 1 + Math.floor(f / 20),
    churu: f % 5 === 0 ? 10 : 0,
    coins: f % 10 === 0 ? 300 * f : 0,
    epicMats: f % 10 === 0 ? 1 : 0,
  };
}

/** のぼった結果を 入れる（cleared: クリアした いちばん上の階）。はじめての階の ごほうびの 合計 */
export function finishTower(save: SaveData, cleared: number): TowerReward {
  const sum: TowerReward = { churu: 0, stones: 0, coins: 0, epicMats: 0 };
  for (let f = save.towerBest + 1; f <= cleared; f++) {
    const r = floorReward(f);
    sum.churu += r.churu; sum.stones += r.stones; sum.coins += r.coins; sum.epicMats += r.epicMats;
  }
  save.towerBest = Math.max(save.towerBest, cleared);
  save.churu += sum.churu; save.stones += sum.stones; save.coins += sum.coins; save.runeMats[G.epic] += sum.epicMats;
  return sum;
}
