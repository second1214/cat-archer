// ねこ修行（タレント）: にぼしで ずっと残る 基礎の力を 少しずつ上げる。
import type { SaveData } from "./save";

export type TalentId = "atk" | "hp" | "crit" | "regen";

export interface TalentDef { id: TalentId; name: string; icon: string; per: number; unit: string; desc: (v: number) => string }

export const TALENT_MAX = 30;

export const TALENTS: readonly TalentDef[] = [
  { id: "atk", name: "爪とぎ修行", icon: "🐾", per: 2, unit: "", desc: (v) => `攻撃力 +${v}` },
  { id: "hp", name: "ひるね修行", icon: "💤", per: 15, unit: "", desc: (v) => `最大体力 +${v}` },
  { id: "crit", name: "ねらい修行", icon: "🎯", per: 0.005, unit: "%", desc: (v) => `会心の出やすさ +${Math.round(v * 1000) / 10}%` },
  { id: "regen", name: "毛づくろい修行", icon: "🫧", per: 0.01, unit: "%", desc: (v) => `ステージクリアで 体力 ${Math.round(v * 100)}% 回復` },
];

export const TALENT_MAP = Object.fromEntries(TALENTS.map((t) => [t.id, t])) as Record<TalentId, TalentDef>;

export const emptyTalents = (): Record<TalentId, number> => ({ atk: 0, hp: 0, crit: 0, regen: 0 });

/** 次のレベルの 値段（にぼし）。最大なら null */
export function talentCost(lv: number): number | null {
  return lv >= TALENT_MAX ? null : Math.round(60 * Math.pow(1.17, lv));
}

export const talentValue = (id: TalentId, lv: number) => TALENT_MAP[id].per * lv;

export function trainTalent(save: SaveData, id: TalentId): boolean {
  const cost = talentCost(save.talents[id]);
  if (cost === null || save.coins < cost) return false;
  save.coins -= cost;
  save.talents[id]++;
  return true;
}
