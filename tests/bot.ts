// テスト用の かんたんな プレイヤー: 戦うあいだは 止まって撃ち、弾が近いと よこへよける。クリアしたら扉へ。
import { mulberry32 } from "../src/core/rng";
import type { Loadout } from "../src/core/save";
import type { SkillId } from "../src/core/skills";
import { W, World, type Input } from "../src/game/world";

export const PREF: SkillId[] = ["multi", "front", "atk", "aspd", "diag", "crit", "ricochet", "bolt", "fire", "hpup", "heal", "orbit"];

export function botInput(w: World): Input {
  const h = w.hero;
  const t = w.terrain;
  const go = (tx: number, ty: number): Input => {
    const d = t.stepDir(t.flow(tx, ty), h.x, h.y);
    return d ? { mx: d[0], my: d[1] } : { mx: tx - h.x, my: ty - h.y };
  };
  if (w.state === "clear") return h.y < 1.2 && Math.abs(h.x - W / 2) < 0.6 ? { mx: (W / 2 - h.x) * 2, my: -1 } : go(W / 2, 0.5);
  // 近い弾・敵から よける
  let ax = 0, ay = 0;
  for (const s of w.eshots) {
    const d = Math.hypot(s.x - h.x, s.y - h.y);
    if (d < 1.4) { ax += (h.x - s.x) / d; ay += (h.y - s.y) / d; }
  }
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - h.x, e.y - h.y);
    if (d < e.def.r + 1.2) { ax += (h.x - e.x) / d; ay += (h.y - e.y) / d; }
  }
  if (Math.hypot(ax, ay) > 0.5) return { mx: ax, my: ay };
  // いちばん近い敵が 物のかげなら、見える所まで 歩く
  let near = w.enemies[0], nd = Infinity;
  for (const e of w.enemies) { const d = Math.hypot(e.x - h.x, e.y - h.y); if (d < nd) { nd = d; near = e; } }
  // 弾の当たり判定は 足もと寄り（弾の高さ +0.3）で 物を見る
  if (near && !t.clearShot(h.x, h.y - 0.05, near.x, near.y)) return go(near.x, near.y);
  return { mx: 0, my: 0 };
}

export function runBot(lo: Loadout, chapter: number, seed = 1, maxT = 900) {
  const w = new World(lo, chapter, mulberry32(seed));
  const dt = 1 / 30;
  while (w.time < maxT && w.state !== "dead" && w.state !== "won") {
    if (w.choices) { w.chooseSkill(PREF.find((p) => w.choices!.includes(p)) ?? w.choices[0]); continue; }
    if (w.event) { w.chooseEvent(w.event.kind === "angel" ? "heal" : "refuse"); continue; }
    w.step(dt, botInput(w));
  }
  return { stage: w.stage, state: w.state, time: w.time, level: w.hero.level, coins: Math.round(w.coins), hp: w.hero.hp };
}
