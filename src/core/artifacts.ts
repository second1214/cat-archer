// 宝物（本家の アーティファクト）。猫が 家じゅうから 集めた 宝物。
// 本家（Game Vault wiki）どおり: 願い（ガチャ）で 手に入る。品質 レア・エピック・レジェンド・ミシック。
// 手に入れると ★0、★15まで（★1つで 基本の力 +50%）。かけら 10個で 解放、星上げは かけら（Archero2Hub の表: レジェンド 20・40…300、ミシック ★8まで 10・★14まで 20・★15 30）。
// エピックから 特別な力。セットは ぜんぶ持つと 効き、いちばん低い星が ★3・6・9・12・15 で 強くなる。
// 願いの確率: ミシック 0.1%・レジェンド 1%・エピック 9%・レア 18%・エピックのかけら 24%・レアのかけら 47.9%。100回で レジェンド以上 かならず。
// 数値は 本家の 1/10（ルーンと同じ）。レア・エピックの 星上げ（10個ずつ）と、かけらが出たときの 数（2個）は 資料に ないので 決めた。
import { weighted, type Rng } from "./rng";
import type { SaveData } from "./save";

export type ArtRarity = 0 | 1 | 2 | 3;
export const ART_RARITY_NAMES = ["レア", "エピック", "レジェンド", "ミシック"] as const;
/** 品質ごとの 基本の力（★1） */
export const ART_BASE: readonly { atk: number; hp: number }[] = [{ atk: 4, hp: 16 }, { atk: 6, hp: 24 }, { atk: 12, hp: 48 }, { atk: 36, hp: 144 }];
export const ART_MAX_STAR = 15;
export const WISH_PITY = 100;

/** 特別な力 */
export interface ArtSpecial { desc: string; dodge?: number; aspd?: number; guard?: number; critRate?: number; critDmg?: number; firePct?: number; poisonPct?: number; bossPct?: number; minionPct?: number; hpPct?: number; orbitPct?: number }

export interface ArtifactDef { id: string; name: string; icon: string; r: ArtRarity; flavor: string; special?: ArtSpecial }

export const ARTIFACTS: readonly ArtifactDef[] = [
  // ミシック
  { id: "manekineko", name: "金のまねき猫", icon: "🐱", r: 3, flavor: "さわると いいことが ある…らしい", special: { desc: "よける確率 +4%", dodge: 0.04 } },
  { id: "kinkeito", name: "金の毛糸玉", icon: "🧶", r: 3, flavor: "ほどいても ほどいても 終わらない", special: { desc: "攻撃の速さ +6%", aspd: 0.06 } },
  { id: "kinsuzu", name: "金の鈴", icon: "🔔", r: 3, flavor: "鳴らすと 飼い主が 走ってくる", special: { desc: "受けるダメージ -4%", guard: 0.04 } },
  { id: "heartribbon", name: "ハートのリボン", icon: "🎀", r: 3, flavor: "燃えるような 赤。飼い主の いちばんの お気に入り", special: { desc: "炎のダメージ +20%", firePct: 0.2 } },
  { id: "kaigara", name: "海のほら貝", icon: "🐚", r: 3, flavor: "耳を あてると 魚の声が する", special: { desc: "会心ダメージ +16%", critDmg: 0.16 } },
  { id: "neko_fue", name: "ねこじゃらしの笛", icon: "🪈", r: 3, flavor: "吹くと 近所の猫が 集まる", special: { desc: "会心率 +4%", critRate: 0.04 } },
  // レジェンド
  { id: "heartcollar", name: "ハートの首輪", icon: "💗", r: 2, flavor: "リボンと おそろい", special: { desc: "毒のダメージ +10%", poisonPct: 0.1 } },
  { id: "broach", name: "宝石のブローチ", icon: "💎", r: 2, flavor: "おばあちゃんの 引き出しで 見つけた", special: { desc: "強い虫・ボス以外への ダメージ +4%", minionPct: 0.04 } },
  { id: "cushion", name: "ハートのクッション", icon: "❤️", r: 2, flavor: "まだ あたたかい", special: { desc: "最大体力 +2%", hpPct: 0.02 } },
  { id: "silverdish", name: "銀のお皿", icon: "🍽️", r: 2, flavor: "ごちそうの日だけ 出てくる", special: { desc: "ボスへの ダメージ +8%", bossPct: 0.08 } },
  // エピック
  { id: "lamp", name: "魔法のランプ", icon: "🪔", r: 1, flavor: "こすると 毛が つく", special: { desc: "受けるダメージ -2%", guard: 0.02 } },
  { id: "carpet", name: "空飛ぶじゅうたん", icon: "🧞", r: 1, flavor: "ただの 玄関マット", special: { desc: "最大体力 +2%", hpPct: 0.02 } },
  { id: "yarnwheel", name: "糸車", icon: "🧵", r: 1, flavor: "まわすと 楽しい", special: { desc: "まわる玉の ダメージ +8%", orbitPct: 0.08 } },
  // レア
  { id: "bottlecap", name: "ペットボトルのふた", icon: "🔵", r: 0, flavor: "最高の サッカーボール" },
  { id: "pumpkin", name: "かぼちゃランタン", icon: "🎃", r: 0, flavor: "ハロウィンの のこり" },
  { id: "magonote", name: "孫の手", icon: "🪃", r: 0, flavor: "王さまの 杖（と 思っている）" },
  { id: "danball", name: "ダンボールの王座", icon: "📦", r: 0, flavor: "ここは わたしの 国" },
  { id: "potstick", name: "植木鉢の 棒", icon: "🪴", r: 0, flavor: "ぬけない。伝説の 剣かもしれない" },
];
export const ART_MAP = Object.fromEntries(ARTIFACTS.map((a) => [a.id, a])) as Record<string, ArtifactDef>;

/** セット（全部 持つと 効く。全部が ★3・6・9・12・15 で 段が上がる）。攻撃力・体力 +% */
export interface ArtSet { id: string; name: string; ids: string[]; pct: readonly number[] }
export const ART_SETS: readonly ArtSet[] = [
  // 本家 Golden Dragon's Treasure（12〜42%）
  { id: "gold", name: "黄金の ねこ屋敷", ids: ["manekineko", "kinkeito", "kinsuzu"], pct: [0.12, 0.18, 0.24, 0.3, 0.36, 0.42] },
  // 本家 Heartseeker Arrow（4〜14%）
  { id: "heart", name: "ハートの おくりもの", ids: ["heartribbon", "heartcollar"], pct: [0.04, 0.06, 0.08, 0.1, 0.12, 0.14] },
  // 本家 Battle Rite（8〜28%）
  { id: "concert", name: "ねこの 音楽会", ids: ["kaigara", "neko_fue", "silverdish"], pct: [0.08, 0.12, 0.16, 0.2, 0.24, 0.28] },
  { id: "grandma", name: "おばあちゃんの 宝箱", ids: ["broach", "cushion"], pct: [0.04, 0.06, 0.08, 0.1, 0.12, 0.14] },
  { id: "arabian", name: "魔法の 夜", ids: ["lamp", "carpet", "yarnwheel"], pct: [0.03, 0.045, 0.06, 0.075, 0.09, 0.105] },
  { id: "junk", name: "ガラクタの 王国", ids: ["bottlecap", "pumpkin", "magonote", "danball", "potstick"], pct: [0.02, 0.03, 0.04, 0.05, 0.06, 0.07] },
];

export interface OwnedArt { owned: boolean; star: number; shards: number }

/** 解放に いる かけら */
export const UNLOCK_SHARDS = 10;
/** 星を上げるのに いる かけら（★star → ★star+1） */
export function starCost(id: string, star: number): number | null {
  if (star >= ART_MAX_STAR) return null;
  const r = ART_MAP[id].r;
  if (r === 2) return 20 * (star + 1);
  if (r === 3) return star < 8 ? 10 : star < 14 ? 20 : 30;
  return 10;
}
/** 同じ宝物が また出たら（まるごと = 解放の分の かけら） */
export const DUP_SHARDS = UNLOCK_SHARDS;
/** 願いで「かけら」が出たときの 数 */
export const SHARD_PULL = 2;

export function artStats(id: string, star: number): { atk: number; hp: number } {
  const b = ART_BASE[ART_MAP[id].r], m = 1 + 0.5 * star;
  return { atk: b.atk * m, hp: b.hp * m };
}

/** セットの 段（-1: まだ。0: 発動。1〜5: いちばん低い星が ★3・6・9・12・15） */
export function setLevel(save: SaveData, set: ArtSet): number {
  if (!set.ids.every((id) => save.artifacts[id]?.owned)) return -1;
  return Math.min(5, Math.floor(Math.min(...set.ids.map((id) => save.artifacts[id].star)) / 3));
}

export interface ArtEffects extends Required<Omit<ArtSpecial, "desc">> { atk: number; hp: number; atkPct: number; setHpPct: number }
export function artifactEffects(save: SaveData): ArtEffects {
  const e: ArtEffects = { atk: 0, hp: 0, atkPct: 0, setHpPct: 0, dodge: 0, aspd: 0, guard: 0, critRate: 0, critDmg: 0, firePct: 0, poisonPct: 0, bossPct: 0, minionPct: 0, hpPct: 0, orbitPct: 0 };
  for (const [id, o] of Object.entries(save.artifacts)) {
    const d = ART_MAP[id];
    if (!d || !o.owned) continue;
    const st = artStats(id, o.star);
    e.atk += st.atk; e.hp += st.hp;
    if (d.special) for (const k of Object.keys(d.special) as (keyof ArtSpecial)[]) if (k !== "desc") e[k] += d.special[k] as number;
  }
  for (const set of ART_SETS) {
    const lv = setLevel(save, set);
    if (lv >= 0) { e.atkPct += set.pct[lv]; e.setHpPct += set.pct[lv]; }
  }
  return e;
}

export type WishResult = { id: string; kind: "new" | "dup" | "shard"; shards: number };

const byR = (r: ArtRarity) => ARTIFACTS.filter((a) => a.r === r);

/** 願う（ねがいの鈴を n個）。できなければ null */
export function wish(save: SaveData, rng: Rng, n: 1 | 10): WishResult[] | null {
  if (save.wishBells < n) return null;
  save.wishBells -= n;
  const out: WishResult[] = [];
  for (let i = 0; i < n; i++) {
    const pity = save.wishPity + 1 >= WISH_PITY;
    type K = "m" | "l" | "e" | "r" | "es" | "rs";
    let k: K = weighted<K>(rng, [["m", 0.1], ["l", 1], ["e", 9], ["r", 18], ["es", 24], ["rs", 47.9]]);
    if (pity && k !== "m" && k !== "l") k = rng() < 0.1 ? "m" : "l";
    save.wishPity = k === "m" || k === "l" ? 0 : save.wishPity + 1;
    const r: ArtRarity = k === "m" ? 3 : k === "l" ? 2 : k === "e" || k === "es" ? 1 : 0;
    const pool = byR(r);
    const d = pool[Math.floor(rng() * pool.length)];
    const o = save.artifacts[d.id] ?? { owned: false, star: 0, shards: 0 };
    if (k === "es" || k === "rs") { o.shards += SHARD_PULL; out.push({ id: d.id, kind: "shard", shards: SHARD_PULL }); }
    else if (!o.owned) { o.owned = true; out.push({ id: d.id, kind: "new", shards: 0 }); }
    else { o.shards += DUP_SHARDS; out.push({ id: d.id, kind: "dup", shards: DUP_SHARDS }); }
    save.artifacts[d.id] = o;
  }
  return out;
}

/** 星を上げる（持っていなければ 解放）。かけらが 足りれば true */
export function starUp(save: SaveData, id: string): boolean {
  const o = save.artifacts[id];
  if (!o) return false;
  const c = o.owned ? starCost(id, o.star) : UNLOCK_SHARDS;
  if (c === null || o.shards < c) return false;
  o.shards -= c;
  if (o.owned) o.star++; else o.owned = true;
  return true;
}
/** 次に いる かけら（解放 か 星上げ。最大なら null） */
export const nextCost = (id: string, o: OwnedArt | undefined) => (o?.owned ? starCost(id, o.star) : UNLOCK_SHARDS);
