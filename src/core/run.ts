// プレイの結果をセーブへ入れる・宝箱・合成・強化（画面から呼ぶ。テストもここを使う）。
import { fodderRarity, ITEM_MAP, MAX_RARITY, mergePartners, MYTHIC, rollItem, upgradeCost, type Item, type Rarity } from "./equip";
import { weighted, type Rng } from "./rng";
import { ENCHANT_COST, enchantSlots, G, MAX_GRADE, minGrade, rollEnchant, RUNE_MAP, RUNE_MERGE_COUNT, RUNE_UNLOCK_CHAPTER, RUNE_TYPES, RUNES, rollRune, type Enchant, type Rune } from "./runes";
import { track } from "./missions";
import { dismantleGf } from "./godforge";
import { CHAPTERS, equippedSet, etchedSlotsOpen, type SaveData } from "./save";
import { STAGES_PER_CHAPTER, type EnemyKind } from "./stages";

export interface RunResult {
  chapter: number;
  stage: number;       // とどいたステージ
  won: boolean;
  coins: number;
  drops: Item[];       // uid はここで つけなおす
  runeDrops?: Rune[];  // uid はここで つけなおす
  churu?: number;
  kills?: number;
  /** 虫の種類ごとの 倒した数（図鑑） */
  killsBy?: Partial<Record<EnemyKind, number>>;
  /** ハードモード */
  hard?: boolean;
}

/** ハードを はじめてクリア: チュール・爪とぎ石 */
export const HARD_FIRST_CHURU = 50;
export const HARD_FIRST_STONES = 5;
/** ハードは その章を ノーマルで クリアすると 遊べる */
export const hardOpen = (save: SaveData, ch: number) => (save.best[ch] ?? 0) >= STAGES_PER_CHAPTER;

/** 図鑑に 倒した数を 足す（ほかの モードからも 呼ぶ） */
export function addBestiary(save: SaveData, by: Partial<Record<EnemyKind, number>> = {}): void {
  for (const [k, n] of Object.entries(by) as [EnemyKind, number][]) save.bestiary[k] = (save.bestiary[k] ?? 0) + n;
}

/** チュールの もらい方（気軽に ガチャを回せる くらい） */
export const CHURU_STAGE = 1;        // ステージを1つクリア
export const CHURU_BOSS = 10;        // ボスを倒す
export const CHURU_PICKUP = 5;       // 床に落ちている チュール（ステージに ときどき）
export const CHURU_CHAPTER = 20;     // 章をクリア（何回でも）
export const CHURU_FIRST_CLEAR = 100; // 章を はじめてクリア
export const CHURU_DAILY = 30;       // 1日1回 はじめて あそぶ
export const CHURU_PICKUP_CHANCE = 0.2;
/** やられたとき チュールで 復活（1プレイ 1回） */
export const REVIVE_COST = 30;

/** 1日1回の チュール（もらえたら その数、もう もらっていれば 0） */
export function claimDaily(save: SaveData, today: string): number {
  if (save.lastDaily === today) return 0;
  save.lastDaily = today;
  save.churu += CHURU_DAILY;
  return CHURU_DAILY;
}

export interface RunReward { coins: number; churu: number; stones: number; items: Item[]; runes: Rune[]; newBest: boolean; unlocked: number | null }

/** 爪とぎ石（ルーンの付与）: 5面を こえると 1、章クリアで 2 + 章/5（ルーンが 解放されてから） */
export function stonesFor(chapter: number, stage: number, won: boolean): number {
  if (chapter < RUNE_UNLOCK_CHAPTER) return 0;
  return (stage > 5 || won ? 1 : 0) + (won ? 2 + Math.floor(chapter / 5) : 0);
}

export function finishRun(save: SaveData, r: RunResult): RunReward {
  const coins = Math.round(r.coins);
  save.coins += coins;
  const items = r.drops.map((d) => ({ ...d, uid: save.nextUid++ }));
  save.items.push(...items);
  const runes = (r.runeDrops ?? []).map((d) => ({ ...d, uid: save.nextUid++ }));
  save.runes.push(...runes);
  const bestMap = r.hard ? save.hardBest : save.best;
  const firstClear = r.won && (bestMap[r.chapter] ?? 0) < STAGES_PER_CHAPTER;
  const churu = (r.churu ?? 0) + (firstClear ? (r.hard ? HARD_FIRST_CHURU : CHURU_FIRST_CLEAR) : 0);
  save.churu += churu;
  const stones = stonesFor(r.chapter, r.stage, r.won) * (r.hard ? 2 : 1) + (firstClear && r.hard ? HARD_FIRST_STONES : 0);
  save.stones += stones;
  const reached = r.won ? STAGES_PER_CHAPTER : Math.max(0, r.stage - 1);
  track(save, "stages", reached);
  track(save, "kills", r.kills ?? 0);
  addBestiary(save, r.killsBy);
  const newBest = reached > (bestMap[r.chapter] ?? 0);
  if (newBest) bestMap[r.chapter] = reached;
  let unlocked: number | null = null;
  if (!r.hard && r.won && r.chapter === save.unlocked && save.unlocked < CHAPTERS) {
    save.unlocked++;
    save.chapter = save.unlocked;
    unlocked = save.unlocked;
  }
  return { coins, churu, stones, items, runes, newBest, unlocked };
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
  track(save, "grow");
  return true;
}

/** 合成: 3つを 1つ上の品質へ（足りない分は 同じ品質の 合成素材）。レベルは いちばん高いもの。 */
export function mergeItem(save: SaveData, uid: number, useMaterials = true): Item | null {
  const base = save.items.find((x) => x.uid === uid);
  if (!base || base.r >= MAX_RARITY) return null;
  const p = mergePartners(save.items, base, equippedSet(save), useMaterials ? save.materials : []);
  if (!p) return null;
  const ids = new Set(p.mates.map((m) => m.uid));
  save.materials[fodderRarity(base.r)] -= p.mats;
  base.lv = Math.max(base.lv, ...p.mates.map((m) => m.lv));
  base.r = (base.r + 1) as Rarity;
  track(save, "grow");
  save.items = save.items.filter((x) => !ids.has(x.uid));
  return base;
}

/** 分解: 装備を 同じ品質の 合成素材 1つにする（付けている装備は できない） */
export function dismantleItem(save: SaveData, uid: number): boolean {
  const it = save.items.find((x) => x.uid === uid);
  if (!it || it.locked || equippedSet(save).has(uid)) return false;
  save.items = save.items.filter((x) => x.uid !== uid);
  // ミシックから上は 作るのに使った レジェンドの数だけ レジェンドの素材に もどす（ミシック = 3つ、+1ごとに +2）
  if (it.r >= MYTHIC) save.materials[4] += 3 + 2 * (it.r - MYTHIC);
  else save.materials[it.r]++;
  dismantleGf(save, it);
  return true;
}

/** まとめて分解（付けている・鍵の かかった装備は とばす）。分解した数 */
export function dismantleMany(save: SaveData, uids: readonly number[]): number {
  return uids.filter((u) => dismantleItem(save, u)).length;
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

/** 合成の相手（同じルーン・同じ品質で 付けていない・付与のないもの。足りない分は 同じ品質の ルーン素材）。できなければ null */
export function runePartners(save: SaveData, base: Rune, useMats = true): { mates: Rune[]; mats: number } | null {
  if (base.g >= MAX_GRADE) return null;
  const eq = runeEquipped(save);
  const mates = save.runes.filter((x) => x.uid !== base.uid && x.id === base.id && x.g === base.g && !eq.has(x.uid) && !x.en?.some(Boolean)).slice(0, RUNE_MERGE_COUNT - 1);
  const mats = RUNE_MERGE_COUNT - 1 - mates.length;
  return mats === 0 || (useMats && (save.runeMats[base.g] ?? 0) >= mats) ? { mates, mats } : null;
}

export function mergeRune(save: SaveData, uid: number, useMats = true): Rune | null {
  const base = save.runes.find((x) => x.uid === uid);
  if (!base) return null;
  const p = runePartners(save, base, useMats);
  if (!p) return null;
  const ids = new Set(p.mates.map((m) => m.uid));
  save.runes = save.runes.filter((x) => !ids.has(x.uid));
  save.runeMats[base.g] -= p.mats;
  base.g++;
  track(save, "grow");
  return base;
}

/** まとめて合成（ルーンどうしだけ。付けているものを 先に土台にする） */
export function mergeAllRunes(save: SaveData): Rune[] {
  const made: Rune[] = [];
  for (;;) {
    const eq = runeEquipped(save);
    const base = [...save.runes].sort((a, b) => Number(eq.has(b.uid)) - Number(eq.has(a.uid)) || a.g - b.g).find((x) => runePartners(save, x, false));
    if (!base) return made;
    made.push(mergeRune(save, base.uid, false)!);
  }
}

/** ルーンを 分解: 同じ品質の ルーン素材 1つ（どのルーンの 合成にも使える）。付けている・付与したものは できない */
export function dismantleRune(save: SaveData, uid: number): boolean {
  const ru = save.runes.find((x) => x.uid === uid);
  if (!ru || runeEquipped(save).has(uid) || ru.en?.some(Boolean)) return false;
  save.runes = save.runes.filter((x) => x.uid !== uid);
  save.runeMats[ru.g]++;
  return true;
}

/** 付与: 爪とぎ石 ENCHANT_COST で 新しい付与を 引く（まだ 入れない。keepEnchant / takeEnchant で決める） */
export function rollRuneEnchant(save: SaveData, uid: number, slot: number, rng: Rng): Enchant | null {
  const ru = save.runes.find((x) => x.uid === uid);
  if (!ru || slot >= enchantSlots(ru.g) || save.stones < ENCHANT_COST) return null;
  save.stones -= ENCHANT_COST;
  return rollEnchant(rng, ru.id);
}
export function setRuneEnchant(save: SaveData, uid: number, slot: number, en: Enchant): void {
  const ru = save.runes.find((x) => x.uid === uid);
  if (!ru || slot >= enchantSlots(ru.g)) return;
  ru.en = [ru.en?.[0] ?? null, ru.en?.[1] ?? null];
  ru.en[slot] = en;
}

/** おみくじ（ルーンの ガチャ）: チュールで ルーンを引く。30回 エピックが出なければ 次は エピック */
export const OMIKUJI_COST = 10;
export const OMIKUJI10_COST = 90;
export const OMIKUJI_PITY = 30;
export const OMIKUJI_RATES: readonly (readonly [number, number])[] = [[G.common, 50], [G.great, 30], [G.rare, 15.5], [G.epic, 4], [G.legend, 0.5]];
export function pullOmikuji(save: SaveData, rng: Rng, count: 1 | 10): Rune[] | null {
  const cost = count === 10 ? OMIKUJI10_COST : OMIKUJI_COST;
  if (save.unlocked < RUNE_UNLOCK_CHAPTER || save.churu < cost) return null;
  save.churu -= cost;
  const out: Rune[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rng();
    const type = roll < 0.02 ? "etched" : roll < 0.1 ? "blessing" : null;
    const pool = RUNES.filter((r) => (type ? r.type === type : r.type === "ability" || r.type === "enhancement"));
    const d = pool[Math.floor(rng() * pool.length)];
    let g = Math.max(minGrade(d.type), weighted(rng, OMIKUJI_RATES));
    if (save.runePity + 1 >= OMIKUJI_PITY && g < G.epic) g = G.epic;
    save.runePity = g >= G.epic ? 0 : save.runePity + 1;
    const ru: Rune = { uid: save.nextUid++, id: d.id, g };
    save.runes.push(ru);
    out.push(ru);
  }
  return out;
}
