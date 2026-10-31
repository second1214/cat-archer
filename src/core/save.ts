// セーブ（ブラウザの localStorage）。読みこむときに 形をととのえる（古い・こわれたデータでも動くように）。
import { CAT_IDS } from "./cats";
import { activeTraits, addStats, emptyStats, ITEM_MAP, itemStats, MAX_LEVEL, SLOTS, type Item, type Rarity, type Slot, type Stats } from "./equip";

const KEY = "cat-archer/save";
export const SAVE_VERSION = 1;
export const CHAPTERS = 10;

export interface SaveData {
  version: number;
  coins: number;
  items: Item[];
  equipped: Partial<Record<Slot, number>>;
  nextUid: number;
  /** 章ごとの いちばん進んだステージ（クリアは 10） */
  best: Record<number, number>;
  /** 遊べる章（1から） */
  unlocked: number;
  /** 前に選んだ章 */
  chapter: number;
  /** 主人公の猫（見た目） */
  cat: string;
  seed: number;
}

export function newSave(): SaveData {
  return {
    version: SAVE_VERSION,
    coins: 0,
    items: [{ uid: 1, id: "keedama", r: 0, lv: 1 }, { uid: 2, id: "akai", r: 0, lv: 1 }],
    equipped: { weapon: 1, collar: 2 },
    nextUid: 3,
    best: {},
    unlocked: 1,
    chapter: 1,
    cat: "chatora",
    seed: Math.floor(Math.random() * 2 ** 31),
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function normalize(raw: unknown): SaveData {
  const base = newSave();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<SaveData>;
  const items = Array.isArray(r.items)
    ? r.items.filter((x): x is Item => !!x && typeof x === "object" && typeof x.id === "string" && !!ITEM_MAP[x.id] && typeof x.uid === "number")
      .map((x) => {
        const rar = Math.max(0, Math.min(3, Math.floor(num(x.r, 0)))) as Rarity;
        return { uid: x.uid, id: x.id, r: rar, lv: Math.max(1, Math.min(MAX_LEVEL[rar], Math.floor(num(x.lv, 1)))) };
      })
    : base.items;
  const equipped: Partial<Record<Slot, number>> = {};
  for (const s of SLOTS) {
    const uid = r.equipped?.[s];
    const it = items.find((x) => x.uid === uid);
    if (it && ITEM_MAP[it.id].slot === s) equipped[s] = it.uid;
  }
  const best: Record<number, number> = {};
  if (r.best && typeof r.best === "object") for (const [k, v] of Object.entries(r.best)) best[Number(k)] = Math.max(0, Math.min(10, Math.floor(num(v, 0))));
  const unlocked = Math.max(1, Math.min(CHAPTERS, Math.floor(num(r.unlocked, 1))));
  return {
    version: SAVE_VERSION,
    coins: Math.max(0, Math.floor(num(r.coins, 0))),
    items,
    equipped,
    nextUid: Math.max(num(r.nextUid, 1), ...items.map((x) => x.uid + 1), 1),
    best,
    unlocked,
    chapter: Math.max(1, Math.min(unlocked, Math.floor(num(r.chapter, 1)))),
    cat: typeof r.cat === "string" && CAT_IDS.has(r.cat) ? r.cat : base.cat,
    seed: Math.floor(num(r.seed, base.seed)),
  };
}

export function loadSave(): SaveData {
  try {
    const s = localStorage.getItem(KEY);
    return s ? normalize(JSON.parse(s)) : newSave();
  } catch {
    return newSave();
  }
}

export function writeSave(save: SaveData): void {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* 保存できなくても遊べる */ }
}

export const equippedSet = (save: SaveData) => new Set(Object.values(save.equipped).filter((v): v is number => typeof v === "number"));
export const equippedItems = (save: SaveData): Item[] =>
  SLOTS.map((s) => save.items.find((x) => x.uid === save.equipped[s])).filter((x): x is Item => !!x);

/** 猫そのものの力（装備なし） */
export const BASE_ATK = 10;
export const BASE_HP = 120;

export interface Loadout {
  stats: Stats;
  atk: number;
  hp: number;
  bounce: number;
  pierce: boolean;
  regen: number;
}

/** 装備をふくめた、プレイ開始時の力。 */
export function loadoutOf(save: SaveData): Loadout {
  let st = emptyStats();
  let bounce = 0, pierce = false, regen = 0;
  for (const it of equippedItems(save)) {
    st = addStats(st, itemStats(it));
    for (const t of activeTraits(it)) {
      bounce += t.bounce ?? 0;
      pierce ||= !!t.pierce;
      regen += t.regen ?? 0;
    }
  }
  return {
    stats: st,
    atk: (BASE_ATK + st.atk) * (1 + st.atkPct),
    hp: Math.round((BASE_HP + st.hp) * (1 + st.hpPct)),
    bounce, pierce, regen,
  };
}

/** 戦力（目安の数字）。 */
export const powerOf = (lo: Loadout) =>
  Math.round(lo.atk * (1 + lo.stats.aspd) * (1 + lo.stats.crit) * 6 + lo.hp * (1 + lo.stats.dodge + lo.stats.guard) * 0.5);
