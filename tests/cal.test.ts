// 難しさの 較正表: CAL=1 npx vitest run tests/cal.test.ts（TIERS=名前:品質:修行Lv,... CHS=章,...）
declare const process: { env: Record<string, string | undefined>; stderr: { write(s: string): void } };
import { it } from "vitest";
import { MAX_LEVEL, type Rarity } from "../src/core/equip";
import { loadoutOf, newSave } from "../src/core/save";
import { runBot, STRONG } from "./bot";
const ids = ["hw_lantern", "hw_mantle", "hw_hat", "hw_collar", "hw_charm"];
const slots = ["weapon", "clothes", "hat", "collar", "charm"] as const;
function build(r: Rarity, tl: number) {
  const s = newSave();
  s.items = ids.map((id, i) => ({ uid: i + 1, id, r, lv: MAX_LEVEL[r] }));
  s.equipped = Object.fromEntries(slots.map((k, i) => [k, i + 1]));
  for (const k of Object.keys(s.talents)) (s.talents as Record<string, number>)[k] = tl;
  return loadoutOf(s);
}
it.skipIf(!process.env.CAL)("較正（CAL=1 のときだけ）", () => {
  const tiers: [string, Rarity, number][] = (process.env.TIERS ?? "L:4:10,M:5:20,M4:9:30,C:10:30").split(",").map((x) => { const [a, b, c] = x.split(":"); return [a, Number(b) as Rarity, Number(c)]; });
  const chs = (process.env.CHS ?? "10,15,20,25,30,35,40,45,50").split(",").map(Number);
  for (const [n, r, tl] of tiers) {
    const lo = build(r, tl);
    const row = chs.map((ch) => { const rs = [1, 2, 3].map((sd) => runBot(lo, ch, sd, 900, STRONG)); return `${ch}:${rs.filter((x) => x.state === "won").length}/${rs.map((x) => x.stage).join("")}`; });
    process.stderr.write([n, Math.round(lo.atk), lo.hp, row.join(" ")].join(" ") + "\n");
  }
}, 600000);
