// 難しさの 較正表: CAL=1 npx vitest run tests/cal.test.ts（TIERS=名前:品質:修行Lv[:ルーン品質[:付与品質]],... CHS=章,...）
declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } };
import { it } from "vitest";
import { MAX_LEVEL, type Rarity } from "../src/core/equip";
import { loadoutOf, newSave } from "../src/core/save";
import { equipRune } from "../src/core/run";
import type { RuneId } from "../src/core/runes";
import { runBot, STRONG } from "./bot";
const ids = ["hw_lantern", "hw_mantle", "hw_hat", "hw_collar", "hw_charm"];
const slots = ["weapon", "clothes", "hat", "collar", "charm"] as const;
const RUNE_SET: RuneId[] = ["tsume", "akaiten", "dragon", "ricochet", "yoru", "netsu", "timeSword", "potion", "guardian", "revive"];
/** rg: ルーンの品質（-1 で なし）。eq: 付与の品質（-1 で なし。famDmg/critDmg 系を つける） */
function build(r: Rarity, tl: number, rg = -1, eq = -1) {
  const s = newSave();
  s.items = ids.map((id, i) => ({ uid: i + 1, id, r, lv: MAX_LEVEL[r] }));
  s.equipped = Object.fromEntries(slots.map((k, i) => [k, i + 1]));
  for (const k of Object.keys(s.talents)) (s.talents as Record<string, number>)[k] = tl;
  if (rg >= 0) RUNE_SET.forEach((id, i) => {
    const g = Math.max(rg, ["guardian", "revive"].includes(id) ? 2 : 0);
    s.runes.push({ uid: 100 + i, id, g, ...(eq >= 0 ? { en: [{ opt: id === "guardian" || id === "revive" || id === "yoru" ? "critDmg" : "famDmg", q: eq }, { opt: "boss", q: eq }] } : {}) });
    equipRune(s, 100 + i);
  });
  return loadoutOf(s);
}
it.skipIf(!process.env.CAL)("較正（CAL=1 のときだけ）", () => {
  const tiers: [string, Rarity, number, number, number][] = (process.env.TIERS ?? "L:4:10,M:5:20,M4:9:30,C:10:30").split(",").map((x) => { const [a, b, c, d, e] = x.split(":"); return [a, Number(b) as Rarity, Number(c), Number(d ?? -1), Number(e ?? -1)]; });
  const chs = (process.env.CHS ?? "10,15,20,25,30,35,40,45,50").split(",").map(Number);
  for (const [n, r, tl, rg, eq] of tiers) {
    const lo = build(r, tl, rg, eq);
    const row = chs.map((ch) => { const rs = [1, 2, 3].map((sd) => runBot(lo, ch, sd, 900, STRONG)); return `${ch}:${rs.filter((x) => x.state === "won").length}/${rs.map((x) => x.stage).join("")}`; });
    process.stderr.write([n, Math.round(lo.atk), lo.hp, row.join(" ")].join(" ") + "\n");
  }
}, 600000);
