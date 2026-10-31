// 装備（ずっと残る強さ）。5つの枠・6つの品質（コモン〜ミシック）。
// 同じ装備・同じ品質を 3つ合わせると 1段上がる。足りない分は「合成素材」（同じ品質の装備を分解して得る）で埋められる。
// ガチャでしか出ない シリーズ装備（飼い主が着せる 季節の衣装）は、そろえると セット効果。
import { weighted, type Rng } from "./rng";
import type { SkillId } from "./skills";

export type Slot = "weapon" | "clothes" | "hat" | "collar" | "charm";
export const SLOTS: readonly Slot[] = ["weapon", "clothes", "hat", "collar", "charm"];
export const SLOT_NAMES: Record<Slot, string> = { weapon: "武器", clothes: "服", hat: "帽子", collar: "首輪", charm: "お守り" };
/** ガチャ・画面での 分類 */
export const SLOT_GROUP: Record<Slot, "武器" | "防具" | "アクセサリー"> = { weapon: "武器", clothes: "防具", hat: "防具", collar: "アクセサリー", charm: "アクセサリー" };

/** 0 コモン … 5 ミシック・6〜9 ミシック+1〜+4・10 カオス（本家の Chaotic） */
export type Rarity = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const MAX_RARITY: Rarity = 10;
export const MYTHIC: Rarity = 5;
export const RARITY_NAMES = ["コモン", "グレート", "レア", "エピック", "レジェンド", "ミシック", "ミシック+1", "ミシック+2", "ミシック+3", "ミシック+4", "カオス"] as const;
/** ミシックから上は 本家と同じく レジェンドを 材料にする（同じ品質3つでは 届かないため） */
export const fodderRarity = (r: Rarity): Rarity => (r >= MYTHIC ? 4 : r);
/** 力の倍率（品質ごと） */
export const RARITY_MUL = [1, 1.4, 1.9, 2.6, 3.6, 5, 5.5, 6.1, 6.7, 7.4, 9] as const;
/** 強化できる最大レベル（品質ごと） */
export const MAX_LEVEL = [10, 15, 20, 30, 40, 60, 65, 70, 75, 80, 100] as const;
/** 合成に使う数（自分を入れて） */
export const MERGE_COUNT = 3;

export interface Stats {
  atk: number;       // 攻撃力（足し算）
  hp: number;        // 体力（足し算）
  hpPct: number;     // 体力 +%
  atkPct: number;    // 攻撃力 +%
  aspd: number;      // 攻撃の速さ +%
  crit: number;      // 会心の出やすさ
  dodge: number;     // よける確率
  guard: number;     // 受けるダメージ -%
  coinPct: number;   // にぼし +%
  laserPct: number;  // レーザーのダメージ +%
  strikePct: number; // 助っ人ねこのダメージ +%
  orbitPct: number;  // まわる玉のダメージ +%
}

export const emptyStats = (): Stats => ({
  atk: 0, hp: 0, hpPct: 0, atkPct: 0, aspd: 0, crit: 0, dodge: 0, guard: 0, coinPct: 0, laserPct: 0, strikePct: 0, orbitPct: 0,
});

/** 品質・セットで 付く効果 */
export interface Trait {
  /** この品質から使える（セット効果では 使わない） */
  at: Rarity;
  desc: string;
  stats?: Partial<Stats>;
  bounce?: number;
  pierce?: boolean;
  /** 毛玉の代わりに レーザー（敵をつらぬく） */
  laser?: boolean;
  regen?: number; // ステージをクリアするたびに 体力の上限のこの割合 回復
  /** プレイのはじめから 持っているスキル */
  startSkills?: SkillId[];
  /** まわる玉 +n */
  orbs?: number;
  /** ボス猫になる確率 + */
  dragon?: number;
}

export type SeriesId = "halloween" | "newyear" | "christmas";

export interface ItemDef {
  id: string;
  slot: Slot;
  name: string;
  icon: string;
  /** レベル・品質で伸びる力（atk・hp は レベルでも伸びる） */
  base: Partial<Stats>;
  traits: Trait[];
  /** 飼い主との ひとこと（世界観） */
  flavor: string;
  /** ガチャでしか出ない シリーズ */
  series?: SeriesId;
}

const T = (at: Rarity, desc: string, more: Omit<Trait, "at" | "desc"> = {}): Trait => ({ at, desc, ...more });

export const ITEMS: readonly ItemDef[] = [
  // ---- 武器 ----
  { id: "keedama", slot: "weapon", name: "毛玉", icon: "🧶", base: { atk: 10 }, flavor: "飼い主の セーターから ほどけた。いちばん手になじむ",
    traits: [T(3, "毛玉が壁で1回はねる", { bounce: 1 }), T(4, "攻撃力 +15%", { stats: { atkPct: 0.15 } }), T(5, "毛玉が壁で さらに1回はねる", { bounce: 1 })] },
  { id: "hone", slot: "weapon", name: "魚の骨", icon: "🦴", base: { atk: 14, aspd: -0.15 }, flavor: "晩ごはんの 残り。こっそり 持ち出した",
    traits: [T(3, "毛玉が敵をつらぬく", { pierce: true }), T(4, "会心の出やすさ +10%", { stats: { crit: 0.1 } }), T(5, "攻撃力 +20%", { stats: { atkPct: 0.2 } })] },
  { id: "laser", slot: "weapon", name: "レーザーポインター", icon: "🔴", base: { atk: 8 }, flavor: "飼い主が 遊んでくれる 赤い点。ついに 手に入れた",
    traits: [T(0, "毛玉の代わりに レーザー（敵をつらぬく）", { laser: true }), T(3, "攻撃の速さ +10%", { stats: { aspd: 0.1 } }), T(4, "攻撃力 +20%", { stats: { atkPct: 0.2 } }), T(5, "レーザーのダメージ +25%", { stats: { laserPct: 0.25 } })] },
  { id: "jarashi", slot: "weapon", name: "ねこじゃらし", icon: "🌾", base: { atk: 7, aspd: 0.2 }, flavor: "見ると つい 体が動く",
    traits: [T(3, "攻撃の速さ +10%", { stats: { aspd: 0.1 } }), T(4, "攻撃力 +20%", { stats: { atkPct: 0.2 } }), T(5, "攻撃の速さ +15%", { stats: { aspd: 0.15 } })] },
  // ---- 防具 ----
  { id: "vest", slot: "clothes", name: "ねこベスト", icon: "🦺", base: { hp: 50, guard: 0.03 }, flavor: "散歩用に 買われた。一度も 散歩していない",
    traits: [T(3, "受けるダメージ -5%", { stats: { guard: 0.05 } }), T(4, "体力 +15%", { stats: { hpPct: 0.15 } }), T(5, "受けるダメージ -8%", { stats: { guard: 0.08 } })] },
  { id: "raincoat", slot: "clothes", name: "レインコート", icon: "🧥", base: { hp: 40, dodge: 0.03 }, flavor: "雨の日に 着せられた。しっぽが 出ない",
    traits: [T(3, "よける確率 +5%", { stats: { dodge: 0.05 } }), T(4, "攻撃の速さ +10%", { stats: { aspd: 0.1 } }), T(5, "よける確率 +6%", { stats: { dodge: 0.06 } })] },
  { id: "mugiwara", slot: "hat", name: "麦わら帽子", icon: "👒", base: { hp: 30, crit: 0.03 }, flavor: "夏の写真のために かぶせられた",
    traits: [T(3, "会心の出やすさ +5%", { stats: { crit: 0.05 } }), T(4, "攻撃力 +10%", { stats: { atkPct: 0.1 } }), T(5, "会心の出やすさ +8%", { stats: { crit: 0.08 } })] },
  { id: "knit", slot: "hat", name: "ニット帽", icon: "🧢", base: { hp: 45, atk: 2 }, flavor: "耳の穴を 開けてもらえた",
    traits: [T(3, "体力 +10%", { stats: { hpPct: 0.1 } }), T(4, "攻撃力 +10%", { stats: { atkPct: 0.1 } }), T(5, "体力 +15%", { stats: { hpPct: 0.15 } })] },
  // ---- アクセサリー ----
  { id: "akai", slot: "collar", name: "赤い首輪", icon: "❤️", base: { hp: 60 }, flavor: "名前入り。迷子になっても 安心",
    traits: [T(3, "ステージをクリアすると 体力を10% 回復", { regen: 0.1 }), T(4, "体力 +20%", { stats: { hpPct: 0.2 } }), T(5, "ステージをクリアすると さらに10% 回復", { regen: 0.1 })] },
  { id: "suzu", slot: "collar", name: "鈴の首輪", icon: "🔔", base: { hp: 40, dodge: 0.04 }, flavor: "どこにいるか すぐバレる",
    traits: [T(3, "よける確率 +5%", { stats: { dodge: 0.05 } }), T(4, "攻撃の速さ +10%", { stats: { aspd: 0.1 } }), T(5, "よける確率 +6%", { stats: { dodge: 0.06 } })] },
  { id: "kawa", slot: "collar", name: "革の首輪", icon: "🟫", base: { hp: 50, guard: 0.05 }, flavor: "ちょっと 大人っぽい",
    traits: [T(3, "受けるダメージ -5%", { stats: { guard: 0.05 } }), T(4, "受けるダメージ -8%", { stats: { guard: 0.08 } }), T(5, "体力 +20%", { stats: { hpPct: 0.2 } })] },
  { id: "sakana", slot: "charm", name: "お魚のお守り", icon: "🐠", base: { atk: 4, atkPct: 0.05 }, flavor: "神社で 飼い主が 買ってきた",
    traits: [T(3, "攻撃力 +8%", { stats: { atkPct: 0.08 } }), T(4, "会心の出やすさ +8%", { stats: { crit: 0.08 } }), T(5, "攻撃力 +12%", { stats: { atkPct: 0.12 } })] },
  { id: "nikukyu", slot: "charm", name: "肉球のお守り", icon: "🐾", base: { crit: 0.05, hp: 20 }, flavor: "自分の 肉球の型を とられた",
    traits: [T(3, "会心の出やすさ +6%", { stats: { crit: 0.06 } }), T(4, "よける確率 +6%", { stats: { dodge: 0.06 } }), T(5, "会心の出やすさ +8%", { stats: { crit: 0.08 } })] },
  { id: "maneki", slot: "charm", name: "招き猫のお守り", icon: "🐈", base: { coinPct: 0.2, atk: 2 }, flavor: "先輩。右手を 上げている",
    traits: [T(3, "にぼし +20%", { stats: { coinPct: 0.2 } }), T(4, "攻撃力 +10%", { stats: { atkPct: 0.1 } }), T(5, "にぼし +30%", { stats: { coinPct: 0.3 } })] },

  // ---- シリーズ（ガチャだけ）: ハロウィン = レーザー ----
  { id: "hw_lantern", series: "halloween", slot: "weapon", name: "かぼちゃランタン", icon: "🎃", base: { atk: 9 }, flavor: "飼い主が 電池を入れた。中から 赤い光が出る",
    traits: [T(0, "毛玉の代わりに レーザー（敵をつらぬく）", { laser: true }), T(3, "レーザーのダメージ +15%", { stats: { laserPct: 0.15 } }), T(4, "攻撃の速さ +15%", { stats: { aspd: 0.15 } }), T(5, "レーザーのダメージ +30%", { stats: { laserPct: 0.3 } })] },
  { id: "hw_mantle", series: "halloween", slot: "clothes", name: "おばけマント", icon: "👻", base: { hp: 45, laserPct: 0.05 }, flavor: "白い布を かぶせられた。前が 見えない",
    traits: [T(3, "レーザーのダメージ +10%", { stats: { laserPct: 0.1 } }), T(4, "よける確率 +5%", { stats: { dodge: 0.05 } }), T(5, "レーザーのダメージ +15%", { stats: { laserPct: 0.15 } })] },
  { id: "hw_hat", series: "halloween", slot: "hat", name: "かぼちゃの帽子", icon: "🎃", base: { hp: 35, laserPct: 0.05 }, flavor: "重くて 首が かたむく",
    traits: [T(3, "レーザーのダメージ +10%", { stats: { laserPct: 0.1 } }), T(4, "会心の出やすさ +6%", { stats: { crit: 0.06 } }), T(5, "レーザーのダメージ +15%", { stats: { laserPct: 0.15 } })] },
  { id: "hw_collar", series: "halloween", slot: "collar", name: "コウモリの首輪", icon: "🦇", base: { hp: 40, laserPct: 0.05 }, flavor: "羽が パタパタ じゃま",
    traits: [T(3, "攻撃の速さ +8%", { stats: { aspd: 0.08 } }), T(4, "レーザーのダメージ +10%", { stats: { laserPct: 0.1 } }), T(5, "攻撃の速さ +12%", { stats: { aspd: 0.12 } })] },
  { id: "hw_charm", series: "halloween", slot: "charm", name: "キャンディのお守り", icon: "🍬", base: { atk: 3, laserPct: 0.05 }, flavor: "なめては いけない",
    traits: [T(3, "レーザーのダメージ +10%", { stats: { laserPct: 0.1 } }), T(4, "攻撃力 +10%", { stats: { atkPct: 0.1 } }), T(5, "レーザーのダメージ +15%", { stats: { laserPct: 0.15 } })] },

  // ---- お正月 = 助っ人ねこ ----
  { id: "ny_kadomatsu", series: "newyear", slot: "weapon", name: "門松の杖", icon: "🎍", base: { atk: 10, strikePct: 0.05 }, flavor: "玄関から 1本 ぬいてきた",
    traits: [T(3, "助っ人ねこのダメージ +15%", { stats: { strikePct: 0.15 } }), T(4, "攻撃力 +15%", { stats: { atkPct: 0.15 } }), T(5, "助っ人ねこのダメージ +30%", { stats: { strikePct: 0.3 } })] },
  { id: "ny_hanten", series: "newyear", slot: "clothes", name: "はんてん", icon: "🧧", base: { hp: 55, strikePct: 0.05 }, flavor: "あたたかい。こたつから 出たくない",
    traits: [T(3, "助っ人ねこのダメージ +10%", { stats: { strikePct: 0.1 } }), T(4, "体力 +15%", { stats: { hpPct: 0.15 } }), T(5, "助っ人ねこのダメージ +15%", { stats: { strikePct: 0.15 } })] },
  { id: "ny_kagami", series: "newyear", slot: "hat", name: "鏡餅のかぶりもの", icon: "🍡", base: { hp: 40, strikePct: 0.05 }, flavor: "正月に 頭に のせられた。重い。みかんが 落ちそう",
    traits: [T(3, "助っ人ねこのダメージ +10%", { stats: { strikePct: 0.1 } }), T(4, "ボス猫になる確率 +10%", { dragon: 0.1 }), T(5, "助っ人ねこのダメージ +15%", { stats: { strikePct: 0.15 } })] },
  { id: "ny_shimenawa", series: "newyear", slot: "collar", name: "しめ縄の首輪", icon: "🪢", base: { hp: 45, strikePct: 0.05 }, flavor: "なんだか ありがたい",
    traits: [T(3, "攻撃の速さ +8%", { stats: { aspd: 0.08 } }), T(4, "助っ人ねこのダメージ +10%", { stats: { strikePct: 0.1 } }), T(5, "ボス猫になる確率 +10%", { dragon: 0.1 })] },
  { id: "ny_daruma", series: "newyear", slot: "charm", name: "だるまのお守り", icon: "🎎", base: { atk: 3, strikePct: 0.05 }, flavor: "片目だけ 描いてある",
    traits: [T(3, "助っ人ねこのダメージ +10%", { stats: { strikePct: 0.1 } }), T(4, "攻撃力 +10%", { stats: { atkPct: 0.1 } }), T(5, "助っ人ねこのダメージ +15%", { stats: { strikePct: 0.15 } })] },

  // ---- クリスマス = まわる玉 ----
  { id: "xm_tree", series: "christmas", slot: "weapon", name: "ツリーの杖", icon: "🎄", base: { atk: 10, orbitPct: 0.05 }, flavor: "飾りの 玉が とれかけている",
    traits: [T(3, "まわる玉のダメージ +20%", { stats: { orbitPct: 0.2 } }), T(4, "まわる玉 +1", { orbs: 1 }), T(5, "まわる玉のダメージ +40%", { stats: { orbitPct: 0.4 } })] },
  { id: "xm_reindeer", series: "christmas", slot: "clothes", name: "トナカイの服", icon: "🦌", base: { hp: 50, orbitPct: 0.05 }, flavor: "角が 2本 生えた",
    traits: [T(3, "まわる玉のダメージ +15%", { stats: { orbitPct: 0.15 } }), T(4, "体力 +15%", { stats: { hpPct: 0.15 } }), T(5, "まわる玉のダメージ +20%", { stats: { orbitPct: 0.2 } })] },
  { id: "xm_santa", series: "christmas", slot: "hat", name: "サンタ帽", icon: "🎅", base: { hp: 40, orbitPct: 0.05 }, flavor: "ぽんぽんが 気になって しかたない",
    traits: [T(3, "まわる玉のダメージ +15%", { stats: { orbitPct: 0.15 } }), T(4, "会心の出やすさ +6%", { stats: { crit: 0.06 } }), T(5, "まわる玉 +1", { orbs: 1 })] },
  { id: "xm_bell", series: "christmas", slot: "collar", name: "ベルの首輪", icon: "🛎️", base: { hp: 45, orbitPct: 0.05 }, flavor: "ジングルベルが 鳴りやまない",
    traits: [T(3, "攻撃の速さ +8%", { stats: { aspd: 0.08 } }), T(4, "まわる玉のダメージ +15%", { stats: { orbitPct: 0.15 } }), T(5, "攻撃の速さ +12%", { stats: { aspd: 0.12 } })] },
  { id: "xm_present", series: "christmas", slot: "charm", name: "プレゼントのお守り", icon: "🎁", base: { atk: 3, orbitPct: 0.05 }, flavor: "中身より 箱が うれしい",
    traits: [T(3, "まわる玉のダメージ +15%", { stats: { orbitPct: 0.15 } }), T(4, "攻撃力 +10%", { stats: { atkPct: 0.1 } }), T(5, "まわる玉のダメージ +20%", { stats: { orbitPct: 0.2 } })] },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((d) => [d.id, d])) as Record<string, ItemDef>;
/** ふつうに 落ちる・宝箱・ガチャで出る（シリーズ以外） */
export const NORMAL_ITEMS = ITEMS.filter((d) => !d.series);

export interface SeriesDef {
  id: SeriesId;
  name: string;
  icon: string;
  /** 何に 特化しているか */
  focus: string;
  /** 2つ・4つ そろえたときの効果 */
  set2: Trait;
  set4: Trait;
}

export const SERIES: readonly SeriesDef[] = [
  { id: "halloween", name: "ハロウィン", icon: "🎃", focus: "レーザーポインター",
    set2: T(0, "レーザーのダメージ +20%", { stats: { laserPct: 0.2 } }),
    set4: T(0, "レーザーが 壁で1回はねる・レーザーのダメージ +30%", { bounce: 1, stats: { laserPct: 0.3 } }) },
  { id: "newyear", name: "お正月", icon: "🎍", focus: "助っ人ねこ（ストライク）",
    set2: T(0, "助っ人ねこのダメージ +25%", { stats: { strikePct: 0.25 } }),
    set4: T(0, "はじめから「助っ人ねこ」を持っている・ボス猫になる確率 +20%", { startSkills: ["s_instant"], dragon: 0.2 }) },
  { id: "christmas", name: "クリスマス", icon: "🎄", focus: "まわる玉",
    set2: T(0, "まわる玉のダメージ +30%", { stats: { orbitPct: 0.3 } }),
    set4: T(0, "はじめから「まわる毛糸」を持っている・まわる玉 +1", { startSkills: ["orbit"], orbs: 1 }) },
];
export const SERIES_MAP = Object.fromEntries(SERIES.map((s) => [s.id, s])) as Record<SeriesId, SeriesDef>;

export interface Item {
  uid: number;
  id: string;
  r: Rarity;
  lv: number;
  /** 鍵（合成の材料・分解に 使わない） */
  locked?: boolean;
}

/** レベルで伸びるのは 攻撃力・体力だけ（% の力は 品質だけで伸びる）。 */
export function itemStats(it: Item): Stats {
  const d = ITEM_MAP[it.id];
  const s = emptyStats();
  if (!d) return s;
  const rm = RARITY_MUL[it.r];
  const lm = 1 + 0.1 * (it.lv - 1);
  for (const [k, v] of Object.entries(d.base) as [keyof Stats, number][]) {
    s[k] += k === "atk" || k === "hp" ? v * rm * lm : v < 0 ? v : v * (1 + 0.25 * it.r);
  }
  for (const t of allTraits(it.id)) {
    if (it.r < t.at || !t.stats) continue;
    for (const [k, v] of Object.entries(t.stats) as [keyof Stats, number][]) s[k] += v;
  }
  return s;
}

/** ミシックより上で どの装備にも 付く 特性（本家の Mythic +2 / +4 / Chaotic にならう） */
export const UPPER_TRAITS: readonly Trait[] = [
  T(7, "ミシック+2: 攻撃力 +3%・最大体力 +3%", { stats: { atkPct: 0.03, hpPct: 0.03 } }),
  T(9, "ミシック+4: 攻撃力 +5%・最大体力 +5%", { stats: { atkPct: 0.05, hpPct: 0.05 } }),
  T(10, "カオス: 攻撃力 +10%・最大体力 +10%・攻撃の速さ +3%", { stats: { atkPct: 0.1, hpPct: 0.1, aspd: 0.03 } }),
];
/** その装備の 特性ぜんぶ（品質で 使えるかは 別） */
export const allTraits = (id: string): Trait[] => [...(ITEM_MAP[id]?.traits ?? []), ...UPPER_TRAITS];

/** 使えるようになった特性 */
export const activeTraits = (it: Item): Trait[] => allTraits(it.id).filter((t) => it.r >= t.at);

/** 付けている装備の シリーズごとの数と、効いている セット効果 */
export function setBonuses(items: readonly Item[]): { series: SeriesDef; count: number; traits: Trait[] }[] {
  const out: { series: SeriesDef; count: number; traits: Trait[] }[] = [];
  for (const sr of SERIES) {
    const count = items.filter((x) => ITEM_MAP[x.id]?.series === sr.id).length;
    if (!count) continue;
    out.push({ series: sr, count, traits: [count >= 2 ? sr.set2 : null, count >= 4 ? sr.set4 : null].filter((x): x is Trait => !!x) });
  }
  return out;
}

export function addStats(a: Stats, b: Stats | Partial<Stats>): Stats {
  const o = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Stats, number][]) o[k] += v;
  return o;
}

/** 強化の値段（にぼし）。最大なら null。 */
export function upgradeCost(it: Item): number | null {
  if (it.lv >= MAX_LEVEL[it.r]) return null;
  return Math.round(40 * it.lv * (1 + it.r * 0.5));
}

/** 合成の材料: 同じ装備・同じ品質の 付けていないもの（レベルの低い順）＋ 足りない分の 合成素材。足りなければ null。
 *  ミシックから上は 同じ装備の レジェンド（または レジェンドの 合成素材）が 材料 */
export function mergePartners(items: readonly Item[], base: Item, equipped: ReadonlySet<number>, materials: readonly number[] = []): { mates: Item[]; mats: number } | null {
  if (base.r >= MAX_RARITY) return null;
  const mates = items
    .filter((x) => x.uid !== base.uid && x.id === base.id && x.r === fodderRarity(base.r) && !equipped.has(x.uid) && !x.locked)
    .sort((a, b) => a.lv - b.lv)
    .slice(0, MERGE_COUNT - 1);
  const mats = MERGE_COUNT - 1 - mates.length;
  return (materials[fodderRarity(base.r)] ?? 0) >= mats ? { mates, mats } : null;
}

/** 落ちる装備の品質（ボスは良いものが出やすい・章が進むと少し良くなる）。 */
export function rollRarity(rng: Rng, chapter: number, boss: boolean): Rarity {
  const up = Math.min(0.15, (chapter - 1) * 0.02) + (boss ? 0.12 : 0);
  // 15章からは ときどき レジェンド（ミシックから先の 材料）
  const legend = chapter >= 15 ? Math.min(0.06, 0.003 * (chapter - 14)) + (boss ? 0.03 : 0) : 0;
  return weighted<Rarity>(rng, [[0, 0.62 - up * 2], [1, 0.28 + up * 0.5], [2, 0.08 + up], [3, 0.02 + up * 0.5], [4, legend]]);
}

/** シリーズ以外から 1つ */
export function rollItem(rng: Rng, uid: number, r: Rarity): Item {
  const d = NORMAL_ITEMS[Math.floor(rng() * NORMAL_ITEMS.length)];
  return { uid, id: d.id, r, lv: 1 };
}
