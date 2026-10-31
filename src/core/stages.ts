// 敵の種類と、章・ステージごとの出かた。1章は10ステージ（5 と 10 はボス）。
export type EnemyKind = "ari" | "hae" | "kumo" | "dango" | "hachi" | "ookumo" | "jooubachi";
export type Ai = "chase" | "wander" | "turret" | "charge" | "kite" | "boss1" | "boss2";

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
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  ari: { kind: "ari", name: "アリ", ai: "chase", hp: 40, r: 0.3, speed: 1.3, dmg: 10, shot: 0, xp: 3, coins: 3 },
  hae: { kind: "hae", name: "ハエ", ai: "wander", hp: 26, r: 0.26, speed: 2.4, dmg: 8, shot: 0, xp: 3, coins: 3 },
  kumo: { kind: "kumo", name: "クモ", ai: "turret", hp: 55, r: 0.33, speed: 0.5, dmg: 10, shot: 12, xp: 4, coins: 4 },
  dango: { kind: "dango", name: "ダンゴムシ", ai: "charge", hp: 70, r: 0.34, speed: 6.5, dmg: 14, shot: 0, xp: 4, coins: 5 },
  hachi: { kind: "hachi", name: "ハチ", ai: "kite", hp: 50, r: 0.3, speed: 1.6, dmg: 10, shot: 10, xp: 5, coins: 5 },
  ookumo: { kind: "ookumo", name: "大グモ", ai: "boss1", hp: 900, r: 0.7, speed: 0.6, dmg: 18, shot: 13, xp: 30, coins: 60, boss: true },
  jooubachi: { kind: "jooubachi", name: "女王バチ", ai: "boss2", hp: 1500, r: 0.65, speed: 1.8, dmg: 20, shot: 14, xp: 50, coins: 120, boss: true },
};

export const STAGES_PER_CHAPTER = 10;

/** ステージごとの敵（1章の形。章が進むと 数と強さが増える）。 */
const PLAN: readonly (readonly [EnemyKind, number][])[] = [
  [["ari", 3]],
  [["ari", 3], ["hae", 2]],
  [["kumo", 2], ["ari", 2]],
  [["dango", 2], ["hae", 3]],
  [["ookumo", 1], ["ari", 2]],
  [["hachi", 2], ["ari", 3]],
  [["kumo", 3], ["dango", 2]],
  [["hachi", 2], ["hae", 4]],
  [["kumo", 2], ["hachi", 2], ["dango", 2]],
  [["jooubachi", 1]],
];

export const CHAPTER_NAMES = ["リビング", "台所", "おふろ場", "子ども部屋", "ものおき", "にわ", "やねうら", "地下室", "となりの家", "公園"];

export interface StageInfo {
  enemies: EnemyKind[];
  boss: boolean;
  hpMul: number;
  dmgMul: number;
}

export function stageInfo(chapter: number, stage: number): StageInfo {
  const plan = PLAN[Math.max(0, Math.min(STAGES_PER_CHAPTER, stage) - 1)];
  const extra = Math.floor((chapter - 1) / 2);
  const enemies: EnemyKind[] = [];
  for (const [k, n] of plan) {
    const add = ENEMIES[k].boss ? 0 : extra;
    for (let i = 0; i < n + add; i++) enemies.push(k);
  }
  return {
    enemies,
    boss: plan.some(([k]) => ENEMIES[k].boss),
    hpMul: Math.pow(1.55, chapter - 1) * (1 + 0.06 * (stage - 1)),
    dmgMul: Math.pow(1.25, chapter - 1),
  };
}
