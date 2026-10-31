// プレイ中だけのスキル（レベルが上がるたびに 3つから1つ選ぶ。プレイが終わると消える）。
import type { Rng } from "./rng";

export type SkillId =
  | "atk" | "aspd" | "crit" | "multi" | "front" | "diag" | "side" | "back"
  | "pierce" | "bounce" | "ricochet" | "fire" | "ice" | "poison" | "bolt"
  | "hpup" | "heal" | "vamp" | "orbit" | "dodge" | "laser" | "homing";

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  desc: string;
  /** 何回まで取れるか */
  max: number;
}

export const SKILLS: readonly SkillDef[] = [
  { id: "atk", name: "つめとぎ", icon: "💪", desc: "攻撃力 +25%", max: 5 },
  { id: "aspd", name: "すばやい前足", icon: "⚡", desc: "攻撃の速さ +20%", max: 5 },
  { id: "crit", name: "ねらいうち", icon: "🎯", desc: "会心の出やすさ +10%・会心ダメージ +40%", max: 4 },
  { id: "multi", name: "れんしゃ", icon: "🔁", desc: "もう1回つづけて撃つ（1発のダメージ -10%）", max: 3 },
  { id: "front", name: "まえに2本", icon: "⏫", desc: "一度に撃つ数 +1（ななめ・よこ・うしろも ふえる。1発のダメージ -15%）", max: 3 },
  { id: "diag", name: "ななめうち", icon: "↗️", desc: "ななめ前にも1本ずつ撃つ", max: 2 },
  { id: "side", name: "よこうち", icon: "↔️", desc: "左右にも1本ずつ撃つ", max: 2 },
  { id: "back", name: "うしろうち", icon: "↩️", desc: "うしろにも1本撃つ", max: 2 },
  { id: "laser", name: "レーザーポインター", icon: "🔴", desc: "ねらった敵へ レーザーも撃つ（敵をつらぬく・攻撃力の60%）", max: 2 },
  { id: "homing", name: "ゆうどう", icon: "🧲", desc: "毛玉が 近くの敵へ 曲がっていく", max: 1 },
  { id: "pierce", name: "つらぬく", icon: "🗡️", desc: "毛玉が敵をつらぬく（ダメージ -25%）", max: 1 },
  { id: "bounce", name: "かべではねる", icon: "🧱", desc: "毛玉が壁で2回はねかえる", max: 1 },
  { id: "ricochet", name: "とびうつる", icon: "🪃", desc: "当たった毛玉が 近くの敵へ2回とびうつる", max: 1 },
  { id: "fire", name: "ほのお", icon: "🔥", desc: "当たると燃える（2秒 毎秒 攻撃力の18%）", max: 2 },
  { id: "ice", name: "こおり", icon: "❄️", desc: "当たると動きが遅くなる（1.5秒 -40%）", max: 1 },
  { id: "poison", name: "どく", icon: "☠️", desc: "当たると毒（ずっと 毎秒 攻撃力の10%）", max: 2 },
  { id: "bolt", name: "かみなり", icon: "🌩️", desc: "当たると近くの敵2体に 攻撃力の35%", max: 2 },
  { id: "hpup", name: "まんぷく", icon: "🍗", desc: "体力の上限 +20%（ふえた分 回復）", max: 5 },
  { id: "heal", name: "おやつ", icon: "🐟", desc: "体力を 40% 回復", max: 99 },
  { id: "vamp", name: "たべちゃう", icon: "🩸", desc: "敵を倒すと 体力の上限の2% 回復", max: 3 },
  { id: "orbit", name: "まわる毛糸", icon: "🧶", desc: "まわりを回る毛糸玉 +2", max: 2 },
  { id: "dodge", name: "ひらり", icon: "💨", desc: "よける確率 +8%", max: 3 },
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

export type SkillCounts = Partial<Record<SkillId, number>>;

/** 毛玉の代わりに レーザーを撃つとき 意味のないスキル */
export const LASER_USELESS: readonly SkillId[] = ["pierce", "bounce", "ricochet", "homing"];

/** まだ取れるスキルから、ちがうものを n 個えらぶ（おやつは体力が減っているときだけ。laser なら 毛玉だけのスキルは出さない）。 */
export function rollSkills(owned: SkillCounts, rng: Rng, n = 3, hurt = false, laser = false): SkillId[] {
  const pool = SKILLS.filter((s) => (owned[s.id] ?? 0) < s.max && (s.id !== "heal" || hurt) && !(laser && LASER_USELESS.includes(s.id))).map((s) => s.id);
  const out: SkillId[] = [];
  while (out.length < n && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
