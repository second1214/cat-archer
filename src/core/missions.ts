// 毎日のミッション: 毎日 かわらない 4つ。ぜんぶで ボーナス。
import { todayStr } from "./daily";
import type { SaveData } from "./save";

export type MissionId = "stages" | "kills" | "grow" | "daily";
export interface MissionDef { id: MissionId; name: string; goal: number; churu: number }
export const MISSIONS: readonly MissionDef[] = [
  { id: "stages", name: "ステージを 10 クリア", goal: 10, churu: 10 },
  { id: "kills", name: "虫を 150匹 追いはらう", goal: 150, churu: 10 },
  { id: "grow", name: "装備・ルーンを 3回 強化・合成", goal: 3, churu: 10 },
  { id: "daily", name: "毎日の挑戦を 2回（掃討も）", goal: 2, churu: 10 },
];
export const MISSION_BONUS = { churu: 20, stones: 5, bells: 2 };

export interface MissionState { day: string; prog: Record<MissionId, number>; claimed: MissionId[]; bonus: boolean }
export const emptyMissions = (): MissionState => ({ day: "", prog: { stages: 0, kills: 0, grow: 0, daily: 0 }, claimed: [], bonus: false });

function roll(save: SaveData, today: string): MissionState {
  if (save.missions.day !== today) save.missions = { ...emptyMissions(), day: today };
  return save.missions;
}
export function missionState(save: SaveData, today = todayStr()): MissionState { return roll(save, today); }

/** 進める（ゲームの いろいろな所から 呼ぶ） */
export function track(save: SaveData, id: MissionId, n = 1, today = todayStr()): void {
  if (n <= 0) return;
  const m = roll(save, today);
  m.prog[id] += n;
}

export const missionDone = (save: SaveData, id: MissionId, today = todayStr()) => {
  const d = MISSIONS.find((x) => x.id === id)!;
  return roll(save, today).prog[id] >= d.goal;
};

/** 受け取る。もらった チュール（できなければ 0） */
export function claimMission(save: SaveData, id: MissionId, today = todayStr()): number {
  const m = roll(save, today);
  const d = MISSIONS.find((x) => x.id === id)!;
  if (m.claimed.includes(id) || m.prog[id] < d.goal) return 0;
  m.claimed.push(id);
  save.churu += d.churu;
  return d.churu;
}
export function claimBonus(save: SaveData, today = todayStr()): boolean {
  const m = roll(save, today);
  if (m.bonus || m.claimed.length < MISSIONS.length) return false;
  m.bonus = true;
  save.churu += MISSION_BONUS.churu; save.stones += MISSION_BONUS.stones; save.wishBells += MISSION_BONUS.bells;
  return true;
}
