// セーブ（ブラウザの localStorage）。読みこむときに 形をととのえる（古い・こわれたデータでも動くように）。
import { CAT_IDS } from "./cats";
import { enchantOpts, ENCHANT_Q_NAMES, G, minGrade, MAX_GRADE, RUNE_MAP, RUNE_SLOTS, RUNE_TYPES, runeEffects, type Rune, type RuneEffects, type RuneType } from "./runes";
import { activeTraits, addStats, emptyStats, ITEM_MAP, itemStats, MAX_LEVEL, MAX_RARITY, setBonuses, SLOTS, type Item, type Rarity, type Slot, type Stats } from "./equip";
import type { SkillId } from "./skills";
import { emptyMissions, MISSIONS, type MissionId, type MissionState } from "./missions";
import { ENEMIES, type EnemyKind } from "./stages";
import { ART_MAP, ART_MAX_STAR, artifactEffects, type OwnedArt } from "./artifacts";
import { DAILIES, DAILY_LEVELS, emptyDaily, type DailyId, type DailyState } from "./daily";
import { emptyTalents, TALENT_MAX, TALENTS, talentValue, type TalentId } from "./talents";

const KEY = "cat-archer/save";
/** 2: 装備の品質を 4段 → 6段（コモン〜ミシック）、枠を 5つに。合成素材・チュール */
export const SAVE_VERSION = 2;
/** 1 の品質（ふつう・レア・エピック・レジェンド）→ 2 の品質 */
const V1_RARITY = [0, 2, 3, 4] as const;
/** はじめの チュール（開発中なので 多め） */
export const START_CHURU = 300;
export const CHAPTERS = 50;

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
  /** 合成素材（品質ごとの数。装備を分解すると ふえる） */
  materials: number[];
  /** チュール（ガチャを回す） */
  churu: number;
  /** シリーズ装備が出ていない回数（天井） */
  gachaPity: number;
  /** 1日1回の チュールを もらった日（YYYY-MM-DD） */
  lastDaily: string;
  /** ルーンの 合成素材（品質ごと。ルーンを 分解すると ふえる） */
  runeMats: number[];
  /** 爪とぎ石（ルーンの 付与に使う） */
  stones: number;
  /** おみくじで エピック以上が 出ていない回数（天井） */
  runePity: number;
  /** 毎日の挑戦 */
  daily: DailyState;
  /** キャットタワーで クリアした いちばん上の階 */
  towerBest: number;
  /** パトロールを 最後に 受け取った時刻（ミリ秒。0 は まだ） */
  patrolAt: number;
  /** 毎日のミッション */
  missions: MissionState;
  /** ハードモードの 章ごとの いちばん進んだステージ */
  hardBest: Record<number, number>;
  /** 図鑑: 虫の種類ごとの 倒した数・受け取った ごほうびの 段 */
  bestiary: Partial<Record<EnemyKind, number>>;
  bestiaryClaimed: Partial<Record<EnemyKind, number>>;
  /** 受け取った 実績 */
  achievements: string[];
  /** 宝物（アーティファクト）: 星と かけら。ねがいの鈴・天井 */
  artifacts: Record<string, OwnedArt>;
  wishBells: number;
  wishPity: number;
  /** ねこ修行（タレント）の レベル */
  talents: Record<TalentId, number>;
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
    materials: [0, 0, 0, 0, 0, 0],
    churu: START_CHURU,
    gachaPity: 0,
    lastDaily: "",
    runeMats: Array(MAX_GRADE + 1).fill(0),
    stones: 0,
    runePity: 0,
    daily: emptyDaily(),
    towerBest: 0,
    patrolAt: 0,
    missions: emptyMissions(),
    hardBest: {},
    bestiary: {},
    bestiaryClaimed: {},
    achievements: [],
    artifacts: {},
    wishBells: 10,
    wishPity: 0,
    talents: emptyTalents(),
    seed: Math.floor(Math.random() * 2 ** 31),
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

const stageMap = (v: unknown): Record<number, number> => {
  const out: Record<number, number> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) out[Number(k)] = Math.max(0, Math.min(10, Math.floor(num(x, 0))));
  return out;
};
const kindMap = (v: unknown): Partial<Record<EnemyKind, number>> => {
  const out: Partial<Record<EnemyKind, number>> = {};
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k in ENEMIES) out[k as EnemyKind] = Math.max(0, Math.floor(num(x, 0)));
  return out;
};

export function normalize(raw: unknown): SaveData {
  const base = newSave();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<SaveData>;
  const old = num(r.version, 1) < 2;
  const items = Array.isArray(r.items)
    ? r.items.filter((x): x is Item => !!x && typeof x === "object" && typeof x.id === "string" && !!ITEM_MAP[x.id] && typeof x.uid === "number")
      .map((x) => {
        const raw = Math.max(0, Math.floor(num(x.r, 0)));
        const rar = (old ? V1_RARITY[Math.min(3, raw)] : Math.min(MAX_RARITY, raw)) as Rarity;
        return { uid: x.uid, id: x.id, r: rar, lv: Math.max(1, Math.min(MAX_LEVEL[rar], Math.floor(num(x.lv, 1)))), ...(x.locked ? { locked: true } : {}) };
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
      .map((x) => {
        const ru: Rune = { uid: x.uid, id: x.id, g: Math.max(minGrade(RUNE_MAP[x.id].type), Math.min(MAX_GRADE, Math.floor(num(x.g, 0)))) };
        if (Array.isArray(x.en)) ru.en = x.en.slice(0, 2).map((en) => en && typeof en === "object" && enchantOpts(ru.id).includes(en.opt)
          ? { opt: en.opt, q: Math.max(0, Math.min(ENCHANT_Q_NAMES.length - 1, Math.floor(num(en.q, 0)))) } : null);
        return ru;
      })
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
    materials: Array.from({ length: MAX_RARITY + 1 }, (_, i) => Math.max(0, Math.floor(num(r.materials?.[i], 0)))),
    churu: Math.max(0, Math.floor(num(r.churu, START_CHURU))),
    gachaPity: Math.max(0, Math.floor(num(r.gachaPity, 0))),
    lastDaily: typeof r.lastDaily === "string" ? r.lastDaily : "",
    runeMats: Array.from({ length: MAX_GRADE + 1 }, (_, i) => Math.max(0, Math.floor(num(r.runeMats?.[i], 0)))),
    stones: Math.max(0, Math.floor(num(r.stones, 0))),
    runePity: Math.max(0, Math.floor(num(r.runePity, 0))),
    daily: {
      day: typeof r.daily?.day === "string" ? r.daily.day : "",
      used: Object.fromEntries(DAILIES.map((d) => [d.id, Math.max(0, Math.floor(num(r.daily?.used?.[d.id], 0)))])) as Record<DailyId, number>,
      best: Object.fromEntries(DAILIES.map((d) => [d.id, Math.max(0, Math.min(DAILY_LEVELS, Math.floor(num(r.daily?.best?.[d.id], 0))))])) as Record<DailyId, number>,
    },
    towerBest: Math.max(0, Math.floor(num(r.towerBest, 0))),
    patrolAt: Math.max(0, num(r.patrolAt, 0)),
    hardBest: stageMap(r.hardBest),
    bestiary: kindMap(r.bestiary),
    bestiaryClaimed: kindMap(r.bestiaryClaimed),
    artifacts: Object.fromEntries(Object.entries(r.artifacts && typeof r.artifacts === "object" ? r.artifacts : {})
      .filter(([id, o]) => ART_MAP[id] && o && typeof o === "object")
      .map(([id, o]) => [id, { star: Math.max(0, Math.min(ART_MAX_STAR, Math.floor(num((o as OwnedArt).star, 0)))), shards: Math.max(0, Math.floor(num((o as OwnedArt).shards, 0))) }])),
    wishBells: Math.max(0, Math.floor(num(r.wishBells, 10))),
    wishPity: Math.max(0, Math.floor(num(r.wishPity, 0))),
    achievements: Array.isArray(r.achievements) ? r.achievements.filter((x): x is string => typeof x === "string") : [],
    missions: {
      day: typeof r.missions?.day === "string" ? r.missions.day : "",
      prog: Object.fromEntries(MISSIONS.map((m) => [m.id, Math.max(0, Math.floor(num(r.missions?.prog?.[m.id], 0)))])) as Record<MissionId, number>,
      claimed: Array.isArray(r.missions?.claimed) ? r.missions.claimed.filter((x): x is MissionId => MISSIONS.some((m) => m.id === x)) : [],
      bonus: !!r.missions?.bonus,
    },
    talents: Object.fromEntries(TALENTS.map((t) => [t.id, Math.max(0, Math.min(TALENT_MAX, Math.floor(num(r.talents?.[t.id], 0))))])) as Record<TalentId, number>,
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
  /** プレイのはじめから 持っているスキル（シリーズのセット効果） */
  startSkills: SkillId[];
  /** まわる玉 + */
  orbs: number;
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
  let bounce = 0, pierce = false, laser = false, regen = 0, orbs = 0, dragon = 0;
  const startSkills: SkillId[] = [];
  // 銘刻は 開いている枠の分だけ 効く
  const open = etchedSlotsOpen(save);
  const runes = equippedRunes(save).filter((x) => RUNE_MAP[x.id].type !== "etched" || save.runeSlots.etched.indexOf(x.uid) < open);
  const rune = runeEffects(runes);
  const worn = equippedItems(save);
  const traits = worn.flatMap(activeTraits).concat(setBonuses(worn).flatMap((b) => b.traits));
  for (const it of worn) st = addStats(st, itemStats(it));
  for (const t of traits) {
    if (!worn.some((it) => ITEM_MAP[it.id].traits.includes(t)) && t.stats) st = addStats(st, t.stats); // セット効果の 数値
    bounce += t.bounce ?? 0;
    pierce ||= !!t.pierce;
    laser ||= !!t.laser;
    regen += t.regen ?? 0;
    orbs += t.orbs ?? 0;
    dragon += t.dragon ?? 0;
    for (const sk of t.startSkills ?? []) if (!startSkills.includes(sk)) startSkills.push(sk);
  }
  rune.dragonChance = Math.min(1, rune.dragonChance + dragon);
  // ねこ修行
  const tl = save.talents;
  st.crit += talentValue("crit", tl.crit);
  st.hpPct += rune.hpPct;
  // 宝物
  const ar = artifactEffects(save);
  st.atk += ar.atk; st.hp += ar.hp; st.atkPct += ar.atkPct; st.hpPct += ar.setHpPct + ar.hpPct;
  st.dodge += ar.dodge; st.aspd += ar.aspd; st.guard += ar.guard; st.crit += ar.critRate; st.orbitPct += ar.orbitPct;
  rune.critDmg += ar.critDmg; rune.firePct += ar.firePct; rune.poisonPct += ar.poisonPct; rune.bossPct += ar.bossPct; rune.minionPct += ar.minionPct;
  regen += talentValue("regen", tl.regen);
  return {
    stats: st,
    atk: (BASE_ATK + st.atk + rune.atk + talentValue("atk", tl.atk)) * (1 + st.atkPct + rune.sturdy.atkPct),
    hp: Math.round((BASE_HP + st.hp + rune.hp + talentValue("hp", tl.hp)) * (1 + st.hpPct + rune.sturdy.hpPct)),
    bounce, pierce, laser, regen, rune, startSkills, orbs,
  };
}

/** 戦力（目安の数字）。 */
export const powerOf = (lo: Loadout) =>
  Math.round(lo.atk * (1 + lo.stats.aspd) * (1 + lo.stats.crit) * 6 + lo.hp * (1 + lo.stats.dodge + lo.stats.guard) * 0.5);
