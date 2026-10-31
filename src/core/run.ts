// プレイの結果をセーブへ入れる・宝箱・合成・強化（画面から呼ぶ。テストもここを使う）。
import { ITEM_MAP, MAX_RARITY, mergePartners, rollItem, upgradeCost, type Item, type Rarity } from "./equip";
import { weighted, type Rng } from "./rng";
import { CHAPTERS, equippedSet, type SaveData } from "./save";
import { STAGES_PER_CHAPTER } from "./stages";

export interface RunResult {
  chapter: number;
  stage: number;       // とどいたステージ
  won: boolean;
  coins: number;
  drops: Item[];       // uid はここで つけなおす
}

export interface RunReward { coins: number; items: Item[]; newBest: boolean; unlocked: number | null }

export function finishRun(save: SaveData, r: RunResult): RunReward {
  const coins = Math.round(r.coins);
  save.coins += coins;
  const items = r.drops.map((d) => ({ ...d, uid: save.nextUid++ }));
  save.items.push(...items);
  const reached = r.won ? STAGES_PER_CHAPTER : Math.max(0, r.stage - 1);
  const newBest = reached > (save.best[r.chapter] ?? 0);
  if (newBest) save.best[r.chapter] = reached;
  let unlocked: number | null = null;
  if (r.won && r.chapter === save.unlocked && save.unlocked < CHAPTERS) {
    save.unlocked++;
    save.chapter = save.unlocked;
    unlocked = save.unlocked;
  }
  return { coins, items, newBest, unlocked };
}

export const CHEST_COST = 300;

export function openChest(save: SaveData, rng: Rng): Item | null {
  if (save.coins < CHEST_COST) return null;
  save.coins -= CHEST_COST;
  const r = weighted<Rarity>(rng, [[0, 0.78], [1, 0.19], [2, 0.03]]);
  const it = rollItem(rng, save.nextUid++, r);
  save.items.push(it);
  return it;
}

export function upgradeItem(save: SaveData, uid: number): boolean {
  const it = save.items.find((x) => x.uid === uid);
  if (!it) return false;
  const cost = upgradeCost(it);
  if (cost === null || save.coins < cost) return false;
  save.coins -= cost;
  it.lv++;
  return true;
}

/** 合成: 3つを 1つ上のレア度へ。レベルは 3つの中で いちばん高いもの。 */
export function mergeItem(save: SaveData, uid: number): Item | null {
  const base = save.items.find((x) => x.uid === uid);
  if (!base || base.r >= MAX_RARITY) return null;
  const mates = mergePartners(save.items, base, equippedSet(save));
  if (!mates) return null;
  const ids = new Set(mates.map((m) => m.uid));
  base.lv = Math.max(base.lv, ...mates.map((m) => m.lv));
  base.r = (base.r + 1) as Rarity;
  save.items = save.items.filter((x) => !ids.has(x.uid));
  return base;
}

/** まとめて合成（合成できなくなるまで。装備中のものを 先に土台にする）。 */
export function mergeAll(save: SaveData): Item[] {
  const made: Item[] = [];
  for (;;) {
    const eq = equippedSet(save);
    const base = [...save.items]
      .sort((a, b) => Number(eq.has(b.uid)) - Number(eq.has(a.uid)) || b.lv - a.lv)
      .find((x) => x.r < MAX_RARITY && mergePartners(save.items, x, eq));
    if (!base) return made;
    const m = mergeItem(save, base.uid);
    if (!m) return made;
    made.push(m);
  }
}

export function equipItem(save: SaveData, uid: number): void {
  const it = save.items.find((x) => x.uid === uid);
  if (!it) return;
  save.equipped[ITEM_MAP[it.id].slot] = uid;
}

export function unequipItem(save: SaveData, uid: number): void {
  const it = save.items.find((x) => x.uid === uid);
  if (!it) return;
  const slot = ITEM_MAP[it.id].slot;
  if (save.equipped[slot] === uid) delete save.equipped[slot];
}
