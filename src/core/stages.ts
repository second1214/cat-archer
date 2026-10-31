// 敵の種類と、章・ステージごとの出かた。1章は10ステージ（5 と 10 はボス）。
// 章が進むと 新しい虫が まざり、ボスも 章ごとに かわる。
export type EnemyKind =
  | "ari" | "hae" | "kumo" | "dango" | "hachi" | "gokiburi" | "ka" | "kemushi" | "kemushiko"
  | "ookumo" | "jooubachi" | "kamakiri";
export type Ai = "chase" | "wander" | "turret" | "charge" | "kite" | "boss1" | "boss2" | "boss3";

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
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  ari: { kind: "ari", name: "アリ", ai: "chase", hp: 40, r: 0.3, speed: 1.3, dmg: 10, shot: 0, xp: 3, coins: 3 },
  hae: { kind: "hae", name: "ハエ", ai: "wander", hp: 26, r: 0.26, speed: 2.4, dmg: 8, shot: 0, xp: 3, coins: 3, fly: true },
  kumo: { kind: "kumo", name: "クモ", ai: "turret", hp: 55, r: 0.33, speed: 0.5, dmg: 10, shot: 12, xp: 4, coins: 4 },
  dango: { kind: "dango", name: "ダンゴムシ", ai: "charge", hp: 70, r: 0.34, speed: 6.5, dmg: 14, shot: 0, xp: 4, coins: 5 },
  hachi: { kind: "hachi", name: "ハチ", ai: "kite", hp: 50, r: 0.3, speed: 1.6, dmg: 10, shot: 10, xp: 5, coins: 5, fly: true },
  gokiburi: { kind: "gokiburi", name: "ゴキブリ", ai: "chase", hp: 34, r: 0.3, speed: 2.5, dmg: 11, shot: 0, xp: 4, coins: 4 },
  ka: { kind: "ka", name: "蚊", ai: "wander", hp: 24, r: 0.24, speed: 1.9, dmg: 8, shot: 9, xp: 4, coins: 4, fly: true },
  kemushi: { kind: "kemushi", name: "毛虫", ai: "chase", hp: 80, r: 0.36, speed: 0.8, dmg: 12, shot: 0, xp: 5, coins: 5, split: "kemushiko" },
  kemushiko: { kind: "kemushiko", name: "子毛虫", ai: "chase", hp: 26, r: 0.24, speed: 1.5, dmg: 8, shot: 0, xp: 1, coins: 1 },
  ookumo: { kind: "ookumo", name: "大グモ", ai: "boss1", hp: 900, r: 0.7, speed: 0.6, dmg: 18, shot: 13, xp: 30, coins: 60, boss: true },
  jooubachi: { kind: "jooubachi", name: "女王バチ", ai: "boss2", hp: 1500, r: 0.65, speed: 1.8, dmg: 20, shot: 14, xp: 50, coins: 120, boss: true, fly: true },
  kamakiri: { kind: "kamakiri", name: "大カマキリ", ai: "boss3", hp: 1200, r: 0.65, speed: 1.4, dmg: 20, shot: 13, xp: 40, coins: 90, boss: true },
};

export const STAGES_PER_CHAPTER = 10;

/** ステージごとの敵の役（1章の形。章が進むと 数と強さが増える）。 */
type Role = "walker" | "flyer" | "turret" | "charger" | "kiter" | "tank" | "boss5" | "boss10";
const PLAN: readonly (readonly [Role, number][])[] = [
  [["walker", 3]],
  [["walker", 3], ["flyer", 2]],
  [["turret", 2], ["walker", 2]],
  [["charger", 2], ["flyer", 3]],
  [["boss5", 1], ["walker", 2]],
  [["kiter", 2], ["walker", 3]],
  [["turret", 3], ["charger", 2]],
  [["kiter", 2], ["flyer", 4]],
  [["turret", 2], ["kiter", 2], ["charger", 2], ["tank", 1]],
  [["boss10", 1]],
];

export const CHAPTER_NAMES = [
  "リビング", "台所", "おふろ場", "子ども部屋", "ものおき", "にわ", "やねうら", "地下室", "となりの家", "公園",
  "雨の日の にわ", "夜の 台所", "大そうじの日", "となり町", "河原", "神社", "商店街", "ペットショップ", "動物病院", "虫の王国",
];

/** 11章から先は ゆっくり 強くなる（装備の レベル・ミシックで 追いつく所） */
export function chapterHp(ch: number): number {
  return ch <= 10 ? Math.pow(1.55, ch - 1) : Math.pow(1.55, 9) * Math.pow(1.14, ch - 10);
}
export function chapterDmg(ch: number): number {
  return ch <= 10 ? Math.pow(1.25, ch - 1) : Math.pow(1.25, 9) * Math.pow(1.07, ch - 10);
}

/** 章ごとの 役 → 虫。ステージの番号で 2種を かわりばんこに使う役もある。 */
function kindFor(role: Role, chapter: number, stage: number): EnemyKind | null {
  const alt = stage % 2 === 0;
  switch (role) {
    case "walker": return chapter >= 2 && alt ? "gokiburi" : "ari";
    case "flyer": return chapter >= 3 && stage >= 4 ? "ka" : "hae";
    case "turret": return "kumo";
    case "charger": return "dango";
    case "kiter": return "hachi";
    case "tank": return chapter >= 4 ? "kemushi" : null;
    case "boss5": return (["ookumo", "kamakiri", "jooubachi"] as const)[(chapter - 1) % 3];
    case "boss10": return (["jooubachi", "ookumo", "kamakiri"] as const)[(chapter - 1) % 3];
  }
}

/** その章で 新しく出てくる虫（ホームで知らせる用） */
export function newEnemiesIn(chapter: number): EnemyKind[] {
  return ({ 2: ["gokiburi", "kamakiri"], 3: ["ka"], 4: ["kemushi"] } as Record<number, EnemyKind[]>)[chapter] ?? [];
}

export interface StageInfo {
  enemies: EnemyKind[];
  boss: boolean;
  hpMul: number;
  dmgMul: number;
}

export function stageInfo(chapter: number, stage: number): StageInfo {
  const s = Math.max(1, Math.min(STAGES_PER_CHAPTER, stage));
  const plan = PLAN[s - 1];
  const extra = Math.floor((chapter - 1) / 2);
  const enemies: EnemyKind[] = [];
  let boss = false;
  for (const [role, n] of plan) {
    const k = kindFor(role, chapter, s);
    if (!k) continue;
    if (ENEMIES[k].boss) boss = true;
    const add = ENEMIES[k].boss || role === "tank" ? 0 : extra;
    for (let i = 0; i < n + add; i++) enemies.push(k);
  }
  return {
    enemies,
    boss,
    hpMul: chapterHp(chapter) * (1 + 0.06 * (s - 1)),
    dmgMul: chapterDmg(chapter),
  };
}
