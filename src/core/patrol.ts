// パトロール（放置報酬）: 遊んでいない あいだも 近所を見回って にぼし・チュール・爪とぎ石を 集める。12時間まで たまる。
import { RUNE_UNLOCK_CHAPTER } from "./runes";
import type { SaveData } from "./save";

export const PATROL_MAX_H = 12;
export const patrolCoinsPerHour = (unlocked: number) => Math.round(50 * Math.pow(1.12, unlocked - 1));

export interface PatrolReward { hours: number; coins: number; churu: number; stones: number }

/** いま 受け取れる分（now: ミリ秒） */
export function patrolPending(save: SaveData, now: number): PatrolReward {
  if (!save.patrolAt) return { hours: 0, coins: 0, churu: 0, stones: 0 };
  const hours = Math.max(0, Math.min(PATROL_MAX_H, (now - save.patrolAt) / 3600000));
  return {
    hours,
    coins: Math.floor(hours * patrolCoinsPerHour(save.unlocked)),
    churu: Math.floor(hours),
    stones: save.unlocked >= RUNE_UNLOCK_CHAPTER ? Math.floor(hours / 2) : 0,
  };
}

/** 受け取る（たまった時間は 0 から）。はじめての ときは 時計を 動かすだけ */
export function claimPatrol(save: SaveData, now: number): PatrolReward {
  const r = patrolPending(save, now);
  save.coins += r.coins; save.churu += r.churu; save.stones += r.stones;
  save.patrolAt = now;
  return r;
}
