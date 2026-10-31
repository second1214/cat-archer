// セーブ（ブラウザの localStorage）。読みこむときに 形をととのえる（古い・こわれたデータでも動くように）。
import { CAT_IDS } from "./cats";
import { G, minGrade, MAX_GRADE, RUNE_MAP, RUNE_SLOTS, RUNE_TYPES, runeEffects, type Rune, type RuneEffects, type RuneType } from "./runes";
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
  /** ルーン（持ち物）と、種類ごとの枠（uid か null） */
  runes: Rune[];
  runeSlots: Record<RuneType, (number | null)[]>;
  seed: number;
}

export const emptyRuneSlots = (): Record<RuneType, (number | null)[]> =>
  Object.fromEntries(RUNE_TYPES.map((t) => [t, Array<number | null>(RUNE_SLOTS[t]).fill(null)])) as Record<RuneType, (number | null)[]>;

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
    runes: [],
    runeSlots: emptyRuneSlots(),
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
  const runes: Rune[] = Array.isArray(r.runes)
    ? r.runes.filter((x): x is Rune => !!x && typeof x === "object" && typeof x.uid === "number" && typeof x.id === "string" && x.id in RUNE_MAP)
      .map((x) => ({ uid: x.uid, id: x.id, g: Math.max(minGrade(RUNE_MAP[x.id].type), Math.min(MAX_GRADE, Math.floor(num(x.g, 0)))) }))
    : [];
  const runeSlots = emptyRuneSlots();
  const used = new Set<number>();
  for (const t of RUNE_TYPES) {
    const src = (r.runeSlots as Record<string, unknown> | undefined)?.[t];
    if (!Array.isArray(src)) continue;
    runeSlots[t] = runeSlots[t].map((_, i) => {
      const uid = src[i];
      const ru = runes.find((x) => x.uid === uid);
      if (!ru || RUNE_MAP[ru.id].type !== t || used.has(ru.uid)) return null;
      used.add(ru.uid);
      return ru.uid;
    });
  }
  return {
    version: SAVE_VERSION,
    coins: Math.max(0, Math.floor(num(r.coins, 0))),
    items,
    equipped,
    nextUid: Math.max(num(r.nextUid, 1), ...items.map((x) => x.uid + 1), ...runes.map((x) => x.uid + 1), 1),
    best,
    unlocked,
    chapter: Math.max(1, Math.min(unlocked, Math.floor(num(r.chapter, 1)))),
    cat: typeof r.cat === "string" && CAT_IDS.has(r.cat) ? r.cat : base.cat,
    runes,
    runeSlots,
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
  laser: boolean;
  regen: number;
  rune: RuneEffects;
}

export const equippedRunes = (save: SaveData): Rune[] =>
  RUNE_TYPES.flatMap((t) => save.runeSlots[t]).map((uid) => save.runes.find((x) => x.uid === uid)).filter((x): x is Rune => !!x);

/** 銘刻の枠: 付けている 祝福・能力・強化が ぜんぶ エピック以上で1つめ、レジェンドで2つめ、レジェンド+2で3つめ */
export function etchedSlotsOpen(save: SaveData): number {
  const std = (["blessing", "ability", "enhancement"] as const).flatMap((t) => save.runeSlots[t])
    .map((uid) => save.runes.find((x) => x.uid === uid)).filter((x): x is Rune => !!x);
  if (!std.length) return 0;
  const low = Math.min(...std.map((x) => x.g));
  return low >= G.legend2 ? 3 : low >= G.legend ? 2 : low >= G.epic ? 1 : 0;
}

/** 装備をふくめた、プレイ開始時の力。 */
export function loadoutOf(save: SaveData): Loadout {
  let st = emptyStats();
  let bounce = 0, pierce = false, laser = false, regen = 0;
  // 銘刻は 開いている枠の分だけ 効く
  const open = etchedSlotsOpen(save);
  const runes = equippedRunes(save).filter((x) => RUNE_MAP[x.id].type !== "etched" || save.runeSlots.etched.indexOf(x.uid) < open);
  const rune = runeEffects(runes);
  for (const it of equippedItems(save)) {
    st = addStats(st, itemStats(it));
    for (const t of activeTraits(it)) {
      bounce += t.bounce ?? 0;
      pierce ||= !!t.pierce;
      laser ||= !!t.laser;
      regen += t.regen ?? 0;
    }
  }
  return {
    stats: st,
    atk: (BASE_ATK + st.atk + rune.atk) * (1 + st.atkPct),
    hp: Math.round((BASE_HP + st.hp + rune.hp) * (1 + st.hpPct)),
    bounce, pierce, laser, regen, rune,
  };
}

/** 戦力（目安の数字）。 */
export const powerOf = (lo: Loadout) =>
  Math.round(lo.atk * (1 + lo.stats.aspd) * (1 + lo.stats.crit) * 6 + lo.hp * (1 + lo.stats.dodge + lo.stats.guard) * 0.5);
