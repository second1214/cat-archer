// キャットタワー（本家の スカイタワー）。
// 1回の挑戦で 5階（いちばん上の 続きから）。とちゅうで やられると その5階は 1つも 数えない。
// 回数の しばりは ない。5階ごとの 区切り（5・10・15…階）には ボス。どの階も はいるときに スキルを1つ選び、階を クリアするたびに「タワーの番猫」が 強いスキルを くれる（レベルアップは ない）。
// 階を クリアするたびに ごほうび、25階ごとに 大きな ごほうび。
import { G, RUNES, type Rune } from "./runes";
import type { Rng } from "./rng";
import type { SaveData } from "./save";

export const TOWER_UNLOCK = 8;
export const TOWER_FLOORS = 5;
/** 階の 強さ（章で いうと どれくらいか） */
export const towerChapter = (floor: number) => 2 + Math.ceil(floor / 2);
/** 階の 中身に使う ステージの形（虫が 多い 後半の面。区切りの 5階めは ボスの面） */
export const TOWER_STAGE_SHAPE = [6, 7, 8, 9, 10] as const;

export interface TowerReward { churu: number; stones: number; coins: number; epicMats: number; bells: number; cores: number; runes: Rune[] }

/** 階 f の ごほうび（25階ごとに 大きい） */
export function floorReward(f: number): Omit<TowerReward, "runes"> & { rune: boolean } {
  const big = f % 25 === 0;
  return {
    churu: big ? 50 : 2,
    coins: 40 * f,
    stones: big ? 10 : 1,
    epicMats: big ? 2 : 0,
    bells: big ? 5 : f % TOWER_FLOORS === 0 ? 1 : 0,
    cores: big ? 4 : 0,
    rune: big,
  };
}

/** この挑戦で のぼる 階（いちばん上の 続きから 5階） */
export const towerRange = (save: SaveData): [number, number] => [save.towerBest + 1, save.towerBest + TOWER_FLOORS];

/** 挑戦の 結果。5階 ぜんぶ クリアしたときだけ 階が 進み ごほうび。できなければ null */
export function finishTower(save: SaveData, won: boolean, rng: Rng): TowerReward | null {
  if (save.unlocked < TOWER_UNLOCK) return null;
  const sum: TowerReward = { churu: 0, stones: 0, coins: 0, epicMats: 0, bells: 0, cores: 0, runes: [] };
  if (!won) return sum;
  const [a, b] = towerRange(save);
  for (let f = a; f <= b; f++) {
    const r = floorReward(f);
    sum.churu += r.churu; sum.stones += r.stones; sum.coins += r.coins; sum.epicMats += r.epicMats; sum.bells += r.bells; sum.cores += r.cores;
    if (r.rune) {
      const pool = RUNES.filter((x) => x.type === "ability" || x.type === "enhancement");
      sum.runes.push({ uid: save.nextUid++, id: pool[Math.floor(rng() * pool.length)].id, g: G.epic });
    }
  }
  save.towerBest = b;
  save.towerPaidTo = Math.max(save.towerPaidTo, b);
  save.churu += sum.churu; save.stones += sum.stones; save.coins += sum.coins; save.runeMats[G.epic] += sum.epicMats; save.wishBells += sum.bells; save.cores += sum.cores;
  save.runes.push(...sum.runes);
  return sum;
}

/** 改修前に のぼった階の うち、まだ もらっていない 新しい ごほうび（ねがいの鈴・神鍛の核・エピックのルーン・25階ごとの チュール・爪とぎ石・素材） */
export function towerBackpay(save: SaveData): Omit<TowerReward, "runes" | "coins"> & { runes: number } {
  const sum = { churu: 0, stones: 0, epicMats: 0, bells: 0, cores: 0, runes: 0 };
  for (let f = save.towerPaidTo + 1; f <= save.towerBest; f++) {
    const r = floorReward(f);
    sum.bells += r.bells; sum.cores += r.cores;
    if (r.rune) { sum.runes++; sum.churu += r.churu; sum.stones += r.stones; sum.epicMats += r.epicMats; }
  }
  return sum;
}
export function claimTowerBackpay(save: SaveData, rng: Rng): ReturnType<typeof towerBackpay> | null {
  const b = towerBackpay(save);
  if (!b.bells && !b.cores && !b.runes) { save.towerPaidTo = save.towerBest; return null; }
  save.wishBells += b.bells; save.cores += b.cores; save.churu += b.churu; save.stones += b.stones; save.runeMats[G.epic] += b.epicMats;
  const pool = RUNES.filter((x) => x.type === "ability" || x.type === "enhancement");
  for (let i = 0; i < b.runes; i++) save.runes.push({ uid: save.nextUid++, id: pool[Math.floor(rng() * pool.length)].id, g: G.epic });
  save.towerPaidTo = save.towerBest;
  return b;
}
