// プレイの結果をセーブへ入れる・宝箱・合成・強化（画面から呼ぶ。テストもここを使う）。
import { ITEM_MAP, MAX_RARITY, mergePartners, rollItem, upgradeCost, type Item, type Rarity } from "./equip";
import { weighted, type Rng } from "./rng";
import { MAX_GRADE, RUNE_MAP, RUNE_MERGE_COUNT, RUNE_UNLOCK_CHAPTER, RUNE_TYPES, rollRune, type Rune } from "./runes";
import { CHAPTERS, equippedSet, etchedSlotsOpen, type SaveData } from "./save";
import { STAGES_PER_CHAPTER } from "./stages";

export interface RunResult {
  chapter: number;
  stage: number;       // とどいたステージ
  won: boolean;
  coins: number;
  drops: Item[];       // uid はここで つけなおす
  runeDrops?: Rune[];  // uid はここで つけなおす
  churu?: number;
}

/** チュールの もらい方（気軽に ガチャを回せる くらい） */
export const CHURU_STAGE = 1;        // ステージを1つクリア
export const CHURU_BOSS = 10;        // ボスを倒す
export const CHURU_PICKUP = 5;       // 床に落ちている チュール（ステージに ときどき）
export const CHURU_CHAPTER = 20;     // 章をクリア（何回でも）
export const CHURU_FIRST_CLEAR = 100; // 章を はじめてクリア
export const CHURU_DAILY = 30;       // 1日1回 はじめて あそぶ
export const CHURU_PICKUP_CHANCE = 0.2;

/** 1日1回の チュール（もらえたら その数、もう もらっていれば 0） */
export function claimDaily(save: SaveData, today: string): number {
  if (save.lastDaily === today) return 0;
  save.lastDaily = today;
  save.churu += CHURU_DAILY;
  return CHURU_DAILY;
}

export interface RunReward { coins: number; churu: number; items: Item[]; runes: Rune[]; newBest: boolean; unlocked: number | null }

export function finishRun(save: SaveData, r: RunResult): RunReward {
  const coins = Math.round(r.coins);
  save.coins += coins;
  const items = r.drops.map((d) => ({ ...d, uid: save.nextUid++ }));
  save.items.push(...items);
  const runes = (r.runeDrops ?? []).map((d) => ({ ...d, uid: save.nextUid++ }));
  save.runes.push(...runes);
  const firstClear = r.won && (save.best[r.chapter] ?? 0) < STAGES_PER_CHAPTER;
  const churu = (r.churu ?? 0) + (firstClear ? CHURU_FIRST_CLEAR : 0);
  save.churu += churu;
  const reached = r.won ? STAGES_PER_CHAPTER : Math.max(0, r.stage - 1);
  const newBest = reached > (save.best[r.chapter] ?? 0);
  if (newBest) save.best[r.chapter] = reached;
  let unlocked: number | null = null;
  if (r.won && r.chapter === save.unlocked && save.unlocked < CHAPTERS) {
    save.unlocked++;
    save.chapter = save.unlocked;
    unlocked = save.unlocked;
  }
  return { coins, churu, items, runes, newBest, unlocked };
}

export const CHEST_COST = 300;

export function openChest(save: SaveData, rng: Rng): Item | Rune | null {
  if (save.coins < CHEST_COST) return null;
  save.coins -= CHEST_COST;
  // ルーンが解放されていれば 20%で ルーン
  if (save.unlocked >= RUNE_UNLOCK_CHAPTER && rng() < 0.2) {
    const ru = rollRune(rng, save.nextUid++, false);
    save.runes.push(ru);
    return ru;
  }
  const r = weighted<Rarity>(rng, [[0, 0.6], [1, 0.27], [2, 0.11], [3, 0.02]]);
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

/** 合成: 3つを 1つ上の品質へ（足りない分は 同じ品質の 合成素材）。レベルは いちばん高いもの。 */
export function mergeItem(save: SaveData, uid: number, useMaterials = true): Item | null {
  const base = save.items.find((x) => x.uid === uid);
  if (!base || base.r >= MAX_RARITY) return null;
  const p = mergePartners(save.items, base, equippedSet(save), useMaterials ? save.materials : []);
  if (!p) return null;
  const ids = new Set(p.mates.map((m) => m.uid));
  save.materials[base.r] -= p.mats;
  base.lv = Math.max(base.lv, ...p.mates.map((m) => m.lv));
  base.r = (base.r + 1) as Rarity;
  save.items = save.items.filter((x) => !ids.has(x.uid));
  return base;
}

/** 分解: 装備を 同じ品質の 合成素材 1つにする（付けている装備は できない） */
export function dismantleItem(save: SaveData, uid: number): boolean {
  const it = save.items.find((x) => x.uid === uid);
  if (!it || it.locked || equippedSet(save).has(uid)) return false;
  save.items = save.items.filter((x) => x.uid !== uid);
  save.materials[it.r]++;
  return true;
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
    // まとめて合成は 装備どうしだけ（合成素材は 使わない）
    const m = mergeItem(save, base.uid, false);
    if (!m) return made;
    made.push(m);
  }
}

/** 鍵を かける・はずす */
export function toggleLock(save: SaveData, uid: number): boolean {
  const it = save.items.find((x) => x.uid === uid);
  if (!it) return false;
  it.locked = !it.locked;
  return it.locked;
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

// ---------------- ルーン ----------------

export const runeEquipped = (save: SaveData) => new Set(RUNE_TYPES.flatMap((t) => save.runeSlots[t]).filter((v): v is number => v !== null));

/** 付ける（同じ種類の 空いている枠へ。銘刻は 開いている枠だけ）。付けられなければ false */
export function equipRune(save: SaveData, uid: number): boolean {
  const ru = save.runes.find((x) => x.uid === uid);
  if (!ru || runeEquipped(save).has(uid)) return false;
  const t = RUNE_MAP[ru.id].type;
  const slots = save.runeSlots[t];
  const limit = t === "etched" ? etchedSlotsOpen(save) : slots.length;
  const i = slots.findIndex((v, k) => v === null && k < limit);
  if (i < 0) return false;
  slots[i] = uid;
  return true;
}

export function unequipRune(save: SaveData, uid: number): void {
  for (const t of RUNE_TYPES) save.runeSlots[t] = save.runeSlots[t].map((v) => (v === uid ? null : v));
}

/** 合成の相手（同じルーン・同じ品質で 付けていないもの）。足りなければ null */
export function runePartners(save: SaveData, base: Rune): Rune[] | null {
  if (base.g >= MAX_GRADE) return null;
  const eq = runeEquipped(save);
  const mates = save.runes.filter((x) => x.uid !== base.uid && x.id === base.id && x.g === base.g && !eq.has(x.uid)).slice(0, RUNE_MERGE_COUNT - 1);
  return mates.length === RUNE_MERGE_COUNT - 1 ? mates : null;
}

export function mergeRune(save: SaveData, uid: number): Rune | null {
  const base = save.runes.find((x) => x.uid === uid);
  if (!base) return null;
  const mates = runePartners(save, base);
  if (!mates) return null;
  const ids = new Set(mates.map((m) => m.uid));
  save.runes = save.runes.filter((x) => !ids.has(x.uid));
  base.g++;
  return base;
}

/** まとめて合成（付けているものを 先に土台にする） */
export function mergeAllRunes(save: SaveData): Rune[] {
  const made: Rune[] = [];
  for (;;) {
    const eq = runeEquipped(save);
    const base = [...save.runes].sort((a, b) => Number(eq.has(b.uid)) - Number(eq.has(a.uid)) || a.g - b.g).find((x) => runePartners(save, x));
    if (!base) return made;
    made.push(mergeRune(save, base.uid)!);
  }
}
