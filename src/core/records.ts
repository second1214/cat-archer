// 図鑑（倒した虫）と 実績。どちらも 受け取ると チュール・爪とぎ石。
import { MAX_RARITY } from "./equip";
import { G } from "./runes";
import type { SaveData } from "./save";
import { ENEMIES, STAGES_PER_CHAPTER, type EnemyKind } from "./stages";

// ---------------- 図鑑 ----------------

export const BUG_NOTES: Record<EnemyKind, string> = {
  ari: "まっすぐ 追いかけてくる。数が 多い",
  hae: "ふらふら 飛ぶ。物の上も こえてくる",
  kumo: "ゆっくり歩いて 糸の弾を 撃つ",
  dango: "止まって ためてから 転がって 突進",
  hachi: "はなれて 3方向に 針を撃つ",
  gokiburi: "とても 速く 追いかけてくる",
  ka: "飛びながら ときどき 針を 飛ばす",
  kemushi: "たおすと 子毛虫 2匹に 分かれる",
  kemushiko: "毛虫の 子ども。小さくて 速い",
  mukade: "長い体で 速く 追いかけてくる",
  batta: "止まっては ぴょんと 跳んでくる",
  ga: "たおすと まわりに 鱗粉の弾を まく",
  katatsumuri: "とても遅いが 大きな弾を 撃つ。かたい",
  tentou: "飛んで はなれ、弾を撃つ。かわいい顔で ようしゃない",
  semi: "ときどき 全方向へ 鳴き声の弾",
  suzume: "飛んで まっすぐ 追ってくる。とても 危ない",
  kabuto: "かたくて 重い 突進",
  ookumo: "ボス。弾を 輪にまき、3方向にも 撃つ",
  jooubachi: "ボス。飛び回り、突進・輪・扇の 弾",
  kamakiri: "ボス。ためて すばやく 切りこむ",
  oomukade: "ボス。大きな体で 追いかけ、弾を まく",
  kabutoou: "ボス。カブトムシの 王。切りこみと 扇の弾",
};
/** 倒した数の 段と ごほうび（チュール） */
export const BESTIARY_STEPS: readonly { kills: number; churu: number }[] = [{ kills: 1, churu: 5 }, { kills: 100, churu: 10 }, { kills: 1000, churu: 30 }];
export const BESTIARY_KINDS = (Object.keys(ENEMIES) as EnemyKind[]);

/** 受け取れる 段（なければ null） */
export function bestiaryNext(save: SaveData, k: EnemyKind): { step: number; churu: number; ready: boolean } | null {
  const step = save.bestiaryClaimed[k] ?? 0;
  if (step >= BESTIARY_STEPS.length) return null;
  const d = BESTIARY_STEPS[step];
  return { step, churu: d.churu, ready: (save.bestiary[k] ?? 0) >= d.kills };
}
export function claimBestiary(save: SaveData, k: EnemyKind): number {
  const n = bestiaryNext(save, k);
  if (!n?.ready) return 0;
  save.bestiaryClaimed[k] = n.step + 1;
  save.churu += n.churu;
  return n.churu;
}

// ---------------- 実績 ----------------

export interface AchDef { id: string; name: string; churu: number; stones: number; done: (s: SaveData) => boolean; progress?: (s: SaveData) => [number, number] }
const cleared = (s: SaveData, map: Record<number, number>) => Object.entries(map).filter(([, v]) => v >= STAGES_PER_CHAPTER).reduce((m, [k]) => Math.max(m, Number(k)), 0);
const totalKills = (s: SaveData) => Object.values(s.bestiary).reduce((a, b) => a + (b ?? 0), 0);

export const ACHIEVEMENTS: readonly AchDef[] = [
  ...[5, 10, 20, 30, 40, 50].map((c, i): AchDef => ({ id: `ch${c}`, name: `第${c}章を クリア`, churu: [30, 50, 80, 100, 150, 200][i], stones: 0, done: (s) => cleared(s, s.best) >= c, progress: (s) => [cleared(s, s.best), c] })),
  ...[5, 10, 20, 30].map((c, i): AchDef => ({ id: `hard${c}`, name: `ハード 第${c}章を クリア`, churu: [50, 80, 150, 200][i], stones: [5, 10, 20, 30][i], done: (s) => cleared(s, s.hardBest) >= c, progress: (s) => [cleared(s, s.hardBest), c] })),
  ...[10, 30, 50, 100].map((f, i): AchDef => ({ id: `tower${f}`, name: `キャットタワー ${f}階`, churu: 0, stones: [10, 20, 40, 80][i], done: (s) => s.towerBest >= f, progress: (s) => [s.towerBest, f] })),
  ...[1000, 10000, 100000].map((n, i): AchDef => ({ id: `kill${n}`, name: `虫を ${n}匹 追いはらう`, churu: [20, 50, 100][i], stones: 0, done: (s) => totalKills(s) >= n, progress: (s) => [totalKills(s), n] })),
  { id: "dex", name: "図鑑を ぜんぶ うめる", churu: 100, stones: 10, done: (s) => BESTIARY_KINDS.every((k) => (s.bestiary[k] ?? 0) > 0), progress: (s) => [BESTIARY_KINDS.filter((k) => (s.bestiary[k] ?? 0) > 0).length, BESTIARY_KINDS.length] },
  { id: "chaos", name: "カオスの 装備を 作る", churu: 100, stones: 0, done: (s) => s.items.some((x) => x.r >= MAX_RARITY) },
  { id: "mythrune", name: "ミシックの ルーンを 作る", churu: 100, stones: 20, done: (s) => s.runes.some((x) => x.g >= G.mythic) },
  { id: "daily10", name: "毎日の挑戦 レベル10を クリア", churu: 0, stones: 20, done: (s) => Math.max(s.daily.best.nibo, s.daily.best.tsume) >= 10 },
];

export const achReady = (s: SaveData, a: AchDef) => !s.achievements.includes(a.id) && a.done(s);
export function claimAchievement(save: SaveData, id: string): boolean {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || !achReady(save, a)) return false;
  save.achievements.push(id);
  save.churu += a.churu; save.stones += a.stones;
  return true;
}
/** 受け取れる物が あるか（ホームの しるし） */
export const recordsReady = (s: SaveData) => ACHIEVEMENTS.some((a) => achReady(s, a)) || BESTIARY_KINDS.some((k) => bestiaryNext(s, k)?.ready);
