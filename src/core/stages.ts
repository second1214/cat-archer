// 敵の種類と、章・ステージごとの出かた。1章は10ステージ（5 と 10 はボス）。
// 章が進むと 新しい虫が まざり、ボスも 章ごとに かわる。
export type EnemyKind =
  | "ari" | "hae" | "kumo" | "dango" | "hachi" | "gokiburi" | "ka" | "kemushi" | "kemushiko"
  | "mukade" | "batta" | "ga" | "katatsumuri" | "tentou" | "semi" | "suzume" | "kabuto"
  | "ookumo" | "jooubachi" | "kamakiri" | "oomukade" | "kabutoou";
export type Ai = "chase" | "wander" | "turret" | "charge" | "kite" | "hop" | "ringer" | "boss1" | "boss2" | "boss3";
/** ステージを組むときの 役 */
export type Role = "walker" | "flyer" | "turret" | "charger" | "kiter";

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  ai: Ai;
  hp: number;
  r: number;       // 当たりの半径
  speed: number;
  dmg: number;     // ぶつかったとき
  shot: number;    // 弾のダメージ
  xp: number;
  coins: number;
  boss?: boolean;
  /** 空を飛ぶ（物・水を こえて動ける） */
  fly?: boolean;
  /** たおすと 分かれる */
  split?: EnemyKind;
  /** たおすと まわりに 弾を n発 */
  deathRing?: number;
  /** 弾の 大きさ・速さの 倍率 */
  shotR?: number;
  shotSpeed?: number;
  /** ステージを組むときの 役（ボス・子ども以外） */
  role?: Role;
  /** はじめて出る章 */
  from?: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  ari: { kind: "ari", name: "アリ", ai: "chase", hp: 40, r: 0.3, speed: 1.3, dmg: 10, shot: 0, xp: 3, coins: 3, role: "walker", from: 1 },
  hae: { kind: "hae", name: "ハエ", ai: "wander", hp: 26, r: 0.26, speed: 2.4, dmg: 8, shot: 0, xp: 3, coins: 3, fly: true, role: "flyer", from: 1 },
  kumo: { kind: "kumo", name: "クモ", ai: "turret", hp: 55, r: 0.33, speed: 0.5, dmg: 10, shot: 12, xp: 4, coins: 4, role: "turret", from: 1 },
  dango: { kind: "dango", name: "ダンゴムシ", ai: "charge", hp: 70, r: 0.34, speed: 6.5, dmg: 14, shot: 0, xp: 4, coins: 5, role: "charger", from: 1 },
  hachi: { kind: "hachi", name: "ハチ", ai: "kite", hp: 50, r: 0.3, speed: 1.6, dmg: 10, shot: 10, xp: 5, coins: 5, fly: true, role: "kiter", from: 1 },
  gokiburi: { kind: "gokiburi", name: "ゴキブリ", ai: "chase", hp: 34, r: 0.3, speed: 2.5, dmg: 11, shot: 0, xp: 4, coins: 4, role: "walker", from: 2 },
  ka: { kind: "ka", name: "蚊", ai: "wander", hp: 24, r: 0.24, speed: 1.9, dmg: 8, shot: 9, xp: 4, coins: 4, fly: true, role: "flyer", from: 3 },
  kemushi: { kind: "kemushi", name: "毛虫", ai: "chase", hp: 80, r: 0.36, speed: 0.8, dmg: 12, shot: 0, xp: 5, coins: 5, split: "kemushiko", role: "walker", from: 4 },
  kemushiko: { kind: "kemushiko", name: "子毛虫", ai: "chase", hp: 26, r: 0.24, speed: 1.5, dmg: 8, shot: 0, xp: 1, coins: 1 },
  mukade: { kind: "mukade", name: "ムカデ", ai: "chase", hp: 60, r: 0.3, speed: 2.1, dmg: 13, shot: 0, xp: 5, coins: 5, role: "walker", from: 5 },
  batta: { kind: "batta", name: "バッタ", ai: "hop", hp: 45, r: 0.28, speed: 6, dmg: 11, shot: 0, xp: 4, coins: 4, role: "charger", from: 6 },
  ga: { kind: "ga", name: "蛾", ai: "wander", hp: 40, r: 0.3, speed: 1.6, dmg: 9, shot: 9, xp: 5, coins: 5, fly: true, deathRing: 6, role: "flyer", from: 7 },
  katatsumuri: { kind: "katatsumuri", name: "カタツムリ", ai: "turret", hp: 110, r: 0.36, speed: 0.3, dmg: 10, shot: 16, xp: 6, coins: 6, shotR: 1.6, shotSpeed: 0.7, role: "turret", from: 8 },
  tentou: { kind: "tentou", name: "テントウムシ", ai: "kite", hp: 48, r: 0.28, speed: 1.8, dmg: 9, shot: 9, xp: 5, coins: 5, fly: true, role: "kiter", from: 9 },
  semi: { kind: "semi", name: "セミ", ai: "ringer", hp: 70, r: 0.32, speed: 0.4, dmg: 10, shot: 10, xp: 6, coins: 6, role: "turret", from: 11 },
  suzume: { kind: "suzume", name: "スズメバチ", ai: "chase", hp: 55, r: 0.3, speed: 2.8, dmg: 14, shot: 0, xp: 6, coins: 6, fly: true, role: "flyer", from: 13 },
  kabuto: { kind: "kabuto", name: "カブトムシ", ai: "charge", hp: 160, r: 0.4, speed: 7, dmg: 18, shot: 0, xp: 8, coins: 8, role: "charger", from: 15 },
  ookumo: { kind: "ookumo", name: "大グモ", ai: "boss1", hp: 900, r: 0.7, speed: 0.6, dmg: 18, shot: 13, xp: 30, coins: 60, boss: true, from: 1 },
  jooubachi: { kind: "jooubachi", name: "女王バチ", ai: "boss2", hp: 1500, r: 0.65, speed: 1.8, dmg: 20, shot: 14, xp: 50, coins: 120, boss: true, fly: true, from: 1 },
  kamakiri: { kind: "kamakiri", name: "大カマキリ", ai: "boss3", hp: 1200, r: 0.65, speed: 1.4, dmg: 20, shot: 13, xp: 40, coins: 90, boss: true, from: 2 },
  oomukade: { kind: "oomukade", name: "大ムカデ", ai: "boss1", hp: 1400, r: 0.7, speed: 1.1, dmg: 22, shot: 14, xp: 50, coins: 110, boss: true, from: 12 },
  kabutoou: { kind: "kabutoou", name: "カブトの王", ai: "boss3", hp: 1800, r: 0.75, speed: 1.2, dmg: 26, shot: 15, xp: 60, coins: 140, boss: true, from: 16 },
};

export const STAGES_PER_CHAPTER = 10;

export const CHAPTER_NAMES = [
  "リビング", "台所", "おふろ場", "子ども部屋", "ものおき", "にわ", "やねうら", "地下室", "となりの家", "公園",
  "雨の日の にわ", "夜の 台所", "大そうじの日", "となり町", "河原", "神社", "商店街", "ペットショップ", "動物病院", "虫の王国の 入口",
  "竹やぶ", "田んぼ", "古い倉庫", "植物園", "学校の 花だん", "夏祭りの 夜店", "キャンプ場", "海辺の家", "灯台", "港の倉庫",
  "雪の日の にわ", "こたつの国", "温泉宿", "山小屋", "森の入口", "深い森", "洞くつ", "地底湖", "古いお城", "お城の天守",
  "雲の上の庭", "月夜の屋根", "星空の公園", "虫の都", "女王の庭園", "黒い森", "虫の塔", "王の回廊", "王の間の前", "虫の王国の 玉座",
];
export const CHAPTER_COUNT = CHAPTER_NAMES.length;

/** 敵の 体力・攻撃の 倍率。10章までは 速く、11〜20章は 装備（カオスまで）で 追いつく所、21章からは ルーンの 育成が いる所 */
export function chapterHp(ch: number): number {
  return grow(ch, 1.55, HP_MID, HP_GROW);
}
export function chapterDmg(ch: number): number {
  return grow(ch, 1.25, DMG_MID, DMG_GROW);
}
function grow(ch: number, early: number, mid: number, late: number): number {
  const a = Math.min(ch, 10) - 1, b = Math.max(0, Math.min(ch, 20) - 10), c = Math.max(0, ch - 20);
  return Math.pow(early, a) * Math.pow(mid, b) * Math.pow(late, c);
}
const HP_MID = 1.27;
const DMG_MID = 1.1;
const HP_GROW = 1.12;
const DMG_GROW = 1.055;

/** 章ごとの 決まった乱数（同じ章は いつも 同じ顔ぶれ） */
function chapterRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SMALL: EnemyKind[] = (Object.keys(ENEMIES) as EnemyKind[]).filter((k) => ENEMIES[k].role);
const BOSSES: EnemyKind[] = (Object.keys(ENEMIES) as EnemyKind[]).filter((k) => ENEMIES[k].boss);

/** 虫の 重さ（ステージの 数の予算で使う。アリ = 1） */
export function weight(k: EnemyKind): number {
  const d = ENEMIES[k];
  return Math.max(0.6, d.hp / 42 + (d.shot > 0 ? 0.25 : 0) + (d.split ? 0.5 : 0) + (d.deathRing ? 0.3 : 0));
}

/** その章に 出る 虫（5種まで。その章で はじめての虫は かならず入る。2章からは 弾を撃つ虫も） */
export function chapterRoster(ch: number): EnemyKind[] {
  const rng = chapterRng(ch * 7919);
  const open = SMALL.filter((k) => (ENEMIES[k].from ?? 1) <= ch);
  const fresh = open.filter((k) => ENEMIES[k].from === ch);
  const out = [...fresh];
  const pool = open.filter((k) => !out.includes(k));
  while (out.length < Math.min(5, open.length) && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  if (ch >= 2 && !out.some((k) => ["turret", "kiter"].includes(ENEMIES[k].role!))) {
    const ranged = open.filter((k) => ["turret", "kiter"].includes(ENEMIES[k].role!));
    out[out.length - 1] = ranged[Math.floor(rng() * ranged.length)];
  }
  return out;
}

/** その章の ボス（5面・10面） */
export function chapterBosses(ch: number): [EnemyKind, EnemyKind] {
  const open = BOSSES.filter((k) => (ENEMIES[k].from ?? 1) <= ch);
  const a = open[(ch - 1) % open.length];
  const rest = open.filter((k) => k !== a);
  return [a, rest[(ch * 7 + 1) % rest.length]];
}

/** その章で 新しく出てくる虫（ホームで知らせる用） */
export function newEnemiesIn(chapter: number): EnemyKind[] {
  return (Object.keys(ENEMIES) as EnemyKind[]).filter((k) => ENEMIES[k].from === chapter && (k !== "ookumo" && k !== "jooubachi" || chapter > 1));
}

export interface StageInfo {
  enemies: EnemyKind[];
  boss: boolean;
  hpMul: number;
  dmgMul: number;
}

/** ステージの 顔ぶれ: 1面は 1種、それから 2種、6面からは 3種。数は 面・章で ふえる（章ごとに ちがう組み合わせ） */
export function stageInfo(chapter: number, stage: number): StageInfo {
  const s = Math.max(1, Math.min(STAGES_PER_CHAPTER, stage));
  const rng = chapterRng(chapter * 7919 + s * 104729);
  const roster = chapterRoster(chapter);
  const enemies: EnemyKind[] = [];
  let boss = false;
  if (s === 5 || s === 10) {
    boss = true;
    const [b5, b10] = chapterBosses(chapter);
    enemies.push(s === 5 ? b5 : b10);
    // 6章から ボスにも 子分
    const adds = chapter >= 6 ? Math.min(4, Math.floor((chapter - 2) / 4)) : 0;
    for (let i = 0; i < adds; i++) enemies.push(roster[Math.floor(rng() * roster.length)]);
  } else {
    const kinds = Math.min(roster.length, s === 1 ? 1 : s < 6 ? 2 : 3);
    // 1面は 軽い虫から
    const pick = (s === 1 ? [...roster].sort((a, b) => weight(a) - weight(b)).slice(0, 2) : [...roster]).sort(() => rng() - 0.5).slice(0, kinds);
    // その章の 新しい虫は 2面から 出しやすく
    const fresh = roster.find((k) => ENEMIES[k].from === chapter);
    if (fresh && s >= 2 && !pick.includes(fresh)) pick[pick.length - 1] = fresh;
    // 重さの 予算で 数を決める（強い虫は 少なめ）
    let budget = 3 + s * 0.45 + Math.min(chapter, 40) * 0.15;
    for (let i = 0; budget > 0.3 && enemies.length < 14; i++) {
      const k = pick[i % pick.length];
      enemies.push(k);
      budget -= weight(k);
    }
  }
  return {
    enemies,
    boss,
    hpMul: chapterHp(chapter) * (1 + 0.06 * (s - 1)),
    dmgMul: chapterDmg(chapter),
  };
}
