// プレイ中だけのスキル（レベルが上がるたびに 3つから1つ選ぶ。プレイが終わると消える）。
import type { Rng } from "./rng";

export type SkillId =
  | "atk" | "aspd" | "crit" | "multi" | "front" | "diag" | "side" | "back"
  | "pierce" | "bounce" | "ricochet" | "fire" | "ice" | "poison" | "bolt"
  | "hpup" | "heal" | "vamp" | "orbit" | "dodge" | "laser" | "homing"
  | StrikeSkill;

/** ストライク（近所の猫が 助けに飛びこむ）の系列 */
export type StrikeSkill = "s_instant" | "s_assault" | "s_pursuit" | "s_riposte" | "s_blitz" | "s_twin" | "s_boost" | "s_enchant" | "s_beam";
/** 助っ人ねこを 呼ぶスキル */
export const STRIKE_SOURCES: readonly SkillId[] = ["s_instant", "s_assault", "s_pursuit", "s_riposte", "s_blitz", "s_beam"];
/** 助っ人ねこを 強くするスキル（呼ぶ手段が あるときだけ 出る） */
export const STRIKE_SUPPORT: readonly SkillId[] = ["s_twin", "s_boost", "s_enchant"];

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  desc: string;
  /** 何回まで取れるか */
  max: number;
  /** ストライクの系列 */
  strike?: boolean;
  /** レア度（0 ふつう・1 レア・2 エピック）。高いほど 出にくい */
  tier?: 0 | 1 | 2;
}

export const TIER_NAMES = ["ふつう", "レア", "エピック"] as const;
/** レア度ごとの 出やすさ */
export const TIER_WEIGHT = [1, 0.6, 0.35] as const;
/** 1プレイで 3択を 引きなおせる回数 */
export const REROLLS = 2;

export const SKILLS: readonly SkillDef[] = [
  { id: "atk", name: "つめとぎ", icon: "💪", desc: "攻撃力 +25%", max: 5 },
  { id: "aspd", name: "すばやい前足", icon: "⚡", desc: "攻撃の速さ +20%", max: 5 },
  { id: "crit", name: "ねらいうち", icon: "🎯", desc: "会心の出やすさ +10%・会心ダメージ +40%", max: 4, tier: 1 },
  { id: "multi", name: "れんしゃ", icon: "🔁", desc: "もう1回つづけて撃つ（1発のダメージ -10%）", max: 3, tier: 2 },
  { id: "front", name: "まえに2本", icon: "⏫", desc: "一度に撃つ数 +1（ななめ・よこ・うしろも ふえる。1発のダメージ -15%）", max: 3, tier: 2 },
  { id: "diag", name: "ななめうち", icon: "↗️", desc: "ななめ前にも1本ずつ撃つ", max: 2, tier: 1 },
  { id: "side", name: "よこうち", icon: "↔️", desc: "左右にも1本ずつ撃つ", max: 2 },
  { id: "back", name: "うしろうち", icon: "↩️", desc: "うしろにも1本撃つ", max: 2 },
  { id: "laser", name: "レーザーポインター", icon: "🔴", desc: "攻撃が レーザーになる（敵をつらぬく・1発のダメージ -20%）", max: 1, tier: 2 },
  { id: "homing", name: "ゆうどう", icon: "🧲", desc: "毛玉・レーザーが 近くの敵へ 曲がっていく", max: 1, tier: 2 },
  { id: "pierce", name: "つらぬく", icon: "🗡️", desc: "毛玉が敵をつらぬく（ダメージ -25%）", max: 1, tier: 1 },
  { id: "bounce", name: "かべではねる", icon: "🧱", desc: "毛玉・レーザーが 壁や物で 2回はねかえる", max: 1, tier: 1 },
  { id: "ricochet", name: "とびうつる", icon: "🪃", desc: "当たった毛玉が 近くの敵へ2回とびうつる", max: 1, tier: 1 },
  { id: "fire", name: "ほのお", icon: "🔥", desc: "当たると燃える（2秒 毎秒 攻撃力の18%）", max: 2 },
  { id: "ice", name: "こおり", icon: "❄️", desc: "当たると動きが遅くなる（1.5秒 -40%）", max: 1 },
  { id: "poison", name: "どく", icon: "☠️", desc: "当たると毒（ずっと 毎秒 攻撃力の10%）", max: 2 },
  { id: "bolt", name: "かみなり", icon: "🌩️", desc: "当たると近くの敵2体に 攻撃力の35%", max: 2, tier: 1 },
  { id: "hpup", name: "まんぷく", icon: "🍗", desc: "体力の上限 +20%（ふえた分 回復）", max: 5 },
  { id: "heal", name: "おやつ", icon: "🐟", desc: "体力を 40% 回復", max: 99 },
  { id: "vamp", name: "たべちゃう", icon: "🩸", desc: "敵を倒すと 体力の上限の2% 回復", max: 3, tier: 1 },
  { id: "orbit", name: "まわる毛糸", icon: "🧶", desc: "まわりを回る毛糸玉 +2", max: 2, tier: 1 },
  { id: "dodge", name: "ひらり", icon: "💨", desc: "よける確率 +8%", max: 3, tier: 1 },
  { id: "s_instant", name: "助っ人ねこ", icon: "🐈", desc: "毎秒 近所の猫が 1匹 敵へ飛びかかる（攻撃力×0.75）", max: 1, strike: true },
  { id: "s_assault", name: "いっしょにアタック", icon: "🐈", desc: "攻撃するたびに 25%で 助っ人ねこが 1匹 飛びかかる", max: 1, strike: true },
  { id: "s_pursuit", name: "おいうち", icon: "🐈", desc: "敵を倒すと 助っ人ねこが 1匹 飛びかかる", max: 1, strike: true },
  { id: "s_riposte", name: "しかえし", icon: "🐈", desc: "ダメージを受けると 助っ人ねこが 5匹 反撃する", max: 1, strike: true },
  { id: "s_blitz", name: "ねこ集会", icon: "🐈", desc: "ステージのはじめに 助っ人ねこが 5匹 飛びかかる", max: 1, strike: true },
  { id: "s_twin", name: "ふたごの助っ人", icon: "🐈", desc: "スキルで来る 助っ人ねこが 2倍", max: 1, strike: true, tier: 2 },
  { id: "s_boost", name: "助っ人の爪とぎ", icon: "🐈", desc: "助っ人ねこの ダメージ +50%", max: 1, strike: true, tier: 1 },
  { id: "s_enchant", name: "おそろいの技", icon: "🐈", desc: "助っ人ねこにも ほのお・こおり・どく・かみなりが のる", max: 1, strike: true, tier: 1 },
  { id: "s_beam", name: "レーザー好きのねこ", icon: "🐈", desc: "2.5秒ごとに レーザーを撃つ猫が来る（攻撃力×0.5 を4回）。ほかの助っ人ねこも レーザーを撃つ", max: 1, strike: true, tier: 2 },
];

export const SKILL_MAP = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<SkillId, SkillDef>;

export type SkillCounts = Partial<Record<SkillId, number>>;

/** 攻撃が レーザーのとき 意味のないスキル（レーザー自身も もう出さない） */
export const LASER_USELESS: readonly SkillId[] = ["pierce", "ricochet", "laser"];

export interface RollOpts {
  /** 体力が減っている（おやつを出す） */
  hurt?: boolean;
  /** 攻撃が レーザー（毛玉だけのスキルは出さない） */
  laser?: boolean;
  /** ルーンなどで 助っ人ねこを呼ぶ手段がある */
  strikeSource?: boolean;
  /** 助っ人ねこのスキルの 出やすさ（重みの倍率） */
  strikeWeight?: number;
  /** この レア度 以上だけ（タワーの番猫） */
  minTier?: number;
}

/** まだ取れるスキルから、ちがうものを n 個えらぶ。 */
export function rollSkills(owned: SkillCounts, rng: Rng, n = 3, o: RollOpts = {}, exclude: readonly SkillId[] = []): SkillId[] {
  const has = (id: SkillId) => (owned[id] ?? 0) > 0;
  const source = !!o.strikeSource || STRIKE_SOURCES.some(has);
  const pool = SKILLS.filter((s) => (owned[s.id] ?? 0) < s.max && (s.id !== "heal" || o.hurt) && !(o.laser && LASER_USELESS.includes(s.id))
    && !(STRIKE_SUPPORT.includes(s.id) && !source) && !exclude.includes(s.id) && (s.tier ?? 0) >= (o.minTier ?? 0));
  const out: SkillId[] = [];
  while (out.length < n && pool.length > 0) {
    const w = pool.map((s) => (s.strike ? o.strikeWeight ?? 1 : 1) * TIER_WEIGHT[s.tier ?? 0]);
    let r = rng() * w.reduce((a, b) => a + b, 0), i = 0;
    while (i < pool.length - 1 && (r -= w[i]) >= 0) i++;
    out.push(pool.splice(i, 1)[0].id);
  }
  return out;
}
