// 毎日の挑戦（本家の ゴールドの洞くつ・ルーンの遺跡 などに あたる）。1日2回ずつ。
// 5面（5面めは ボス）。やられても 進んだ分だけ もらえる。クリアすると 次のレベルが開き、クリアしたレベルは「掃討」で すぐ もらえる。
import { G } from "./runes";
import type { SaveData } from "./save";
import { track } from "./missions";

export type DailyId = "nibo" | "tsume";
export interface DailyDef { id: DailyId; name: string; icon: string; desc: string; unlock: number }
export const DAILIES: readonly DailyDef[] = [
  { id: "nibo", name: "にぼし倉庫", icon: "🐟", desc: "魚屋の 倉庫に 虫が いっぱい。追いはらえば にぼしを わけてもらえる", unlock: 3 },
  { id: "tsume", name: "爪とぎの祠", icon: "🪨", desc: "神社の うらの 祠。爪とぎ石と ルーン素材が 見つかる", unlock: 5 },
];
export const DAILY_MAP = Object.fromEntries(DAILIES.map((d) => [d.id, d])) as Record<DailyId, DailyDef>;
export const DAILY_TRIES = 2;
export const DAILY_STAGES = 5;
export const DAILY_LEVELS = 24;

/** レベルの 強さ（どの章くらいの 敵か） */
export const levelChapter = (lv: number) => 1 + 2 * lv;

export interface DailyReward { coins: number; stones: number; mats: { g: number; n: number } | null; cores?: number }

/** もらえる物（cleared: クリアした面の数 0〜5） */
export function dailyReward(id: DailyId, lv: number, cleared: number): DailyReward {
  const full = cleared >= DAILY_STAGES;
  if (id === "nibo") {
    const per = Math.round(40 * Math.pow(1.3, lv - 1));
    return { coins: per * cleared + (full ? per * 3 : 0), stones: 0, mats: null };
  }
  return {
    coins: 0,
    stones: cleared * (1 + Math.floor(lv / 4)) + (full ? 3 : 0),
    mats: full ? { g: Math.min(G.epic1, Math.floor((lv - 1) / 4)), n: 2 + Math.floor(lv / 6) } : null,
    // レベル13から 神鍛の核
    cores: full && lv >= 13 ? 1 : 0,
  };
}

export interface DailyState { day: string; used: Record<DailyId, number>; best: Record<DailyId, number> }
export const emptyDaily = (): DailyState => ({ day: "", used: { nibo: 0, tsume: 0 }, best: { nibo: 0, tsume: 0 } });

/** 日が かわったら 回数を もどす */
function roll(save: SaveData, today: string): void {
  if (save.daily.day !== today) { save.daily.day = today; save.daily.used = { nibo: 0, tsume: 0 }; }
}
export function triesLeft(save: SaveData, id: DailyId, today: string): number {
  roll(save, today);
  return Math.max(0, DAILY_TRIES - save.daily.used[id]);
}
export const dailyOpen = (save: SaveData, id: DailyId) => save.unlocked >= DAILY_MAP[id].unlock;
/** 挑戦できる いちばん上の レベル */
export const maxLevel = (save: SaveData, id: DailyId) => Math.min(DAILY_LEVELS, save.daily.best[id] + 1);

function give(save: SaveData, r: DailyReward): void {
  save.coins += r.coins;
  save.stones += r.stones;
  if (r.mats) save.runeMats[r.mats.g] += r.mats.n;
  save.cores += r.cores ?? 0;
}

/** 挑戦の 結果を 入れる（回数を 1つ使う）。もらった物。できなければ null */
export function finishDaily(save: SaveData, id: DailyId, lv: number, cleared: number, today: string): DailyReward | null {
  if (!dailyOpen(save, id) || triesLeft(save, id, today) <= 0 || lv < 1 || lv > maxLevel(save, id)) return null;
  save.daily.used[id]++;
  track(save, "daily", 1, today);
  const r = dailyReward(id, lv, Math.max(0, Math.min(DAILY_STAGES, cleared)));
  give(save, r);
  if (cleared >= DAILY_STAGES) save.daily.best[id] = Math.max(save.daily.best[id], lv);
  return r;
}

/** 掃討: クリアした いちばん上の レベルを 戦わずに（回数を 1つ使う） */
export function sweepDaily(save: SaveData, id: DailyId, today: string): DailyReward | null {
  const lv = save.daily.best[id];
  if (lv < 1) return null;
  return finishDaily(save, id, lv, DAILY_STAGES, today);
}

export function todayStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
