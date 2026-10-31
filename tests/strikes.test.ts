import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/core/rng";
import { equipRune } from "../src/core/run";
import { G, type RuneId } from "../src/core/runes";
import { loadoutOf, newSave } from "../src/core/save";
import { World } from "../src/game/world";

function world(opts: { skills?: Record<string, number>; rune?: [RuneId, number] } = {}) {
  const s = newSave();
  if (opts.rune) { s.runes = [{ uid: 50, id: opts.rune[0], g: opts.rune[1] }]; equipRune(s, 50); }
  const w = new World(loadoutOf(s), 1, mulberry32(3));
  Object.assign(w.skills, opts.skills ?? {});
  for (const e of w.enemies) { e.def = { ...e.def, ai: "turret", speed: 0 }; e.t = 99; e.hp = e.maxHp = 1e6; }
  return w;
}
const place = (w: World, d: number) => {
  const [a, b, c] = w.enemies;
  a.x = w.hero.x; a.y = w.hero.y - d; b.x = 0.5; b.y = 0.5; c.x = 8.5; c.y = 0.5;
  return a;
};

describe("助っ人ねこ（ストライク）", () => {
  it("助っ人ねこ: 移動中でも 来る（止まらなくてよい）", () => {
    const w = world({ skills: { s_instant: 1 } });
    place(w, 3);
    w.step(1 / 60, { mx: 1, my: 0 });
    expect(w.strikes.list.length).toBe(1);
    expect(w.shots.length).toBe(0);
  });
  it("敵が遠すぎると 来ない", () => {
    const w = world({ skills: { s_instant: 1 } });
    place(w, 8);
    w.hero.x = 4.5; w.hero.y = 14.5;
    for (const e of w.enemies) { e.y = Math.min(e.y, 5); }
    w.step(1 / 60, { mx: 1, my: 0 });
    expect(w.strikes.list.length).toBe(0);
  });
  it("ダメージは 攻撃力×0.75（爪とぎで 1.5倍）。武器の「まえに2本」の減りは のらない", () => {
    for (const [skills, mul] of [[{ s_instant: 1 }, 1], [{ s_instant: 1, s_boost: 1, front: 3 }, 1.5]] as const) {
      const w = world({ skills });
      const a = place(w, 3);
      for (let i = 0; i < 40; i++) w.step(1 / 60, { mx: 1, my: 0 });
      const lost = 1e6 - a.hp;
      const v = w.atk * 0.75 * mul;
      expect([v, v * w.critMul].some((x) => Math.abs(x - lost) < 1e-6)).toBe(true);
    }
  });
  it("攻撃の速さが上がると よく来る", () => {
    const count = (aspd: number) => {
      const w = world({ skills: { s_instant: 1, aspd } });
      place(w, 3);
      let n = 0;
      const orig = w.strikes.summon.bind(w.strikes);
      w.strikes.summon = (c: number, b?: boolean) => { const r = orig(c, b); if (r) n++; return r; };
      for (let i = 0; i < 600; i++) w.step(1 / 60, { mx: 1, my: 0 });
      return n;
    };
    expect(count(3)).toBeGreaterThan(count(0) * 1.4);
  });
  it("ふたごの助っ人: スキルで来る数が 2倍。ねこ集会: ステージのはじめに 5匹", () => {
    const w = world({ skills: { s_blitz: 1, s_twin: 1 } });
    w.startStage(1);
    for (const e of w.enemies) { e.def = { ...e.def, ai: "turret", speed: 0 }; e.t = 99; e.hp = e.maxHp = 1e6; }
    place(w, 3);
    w.strikes.onStageStart();
    expect(w.strikes.list.length).toBe(10);
  });
  it("物は 通れない", () => {
    const w = world({ skills: { s_instant: 1 } });
    w.terrain.tiles[11 * 9 + 4] = 1;
    const a = place(w, 4);
    for (let i = 0; i < 60; i++) w.step(1 / 60, { mx: 0.0001, my: 0 });
    expect(a.hp).toBe(1e6);
  });
  it("ボス猫の気配 ミシック: かならず ボス猫（攻撃力×1.0）", () => {
    const w = world({ skills: { s_instant: 1 }, rune: ["dragon", G.mythic] });
    place(w, 3);
    w.step(1 / 60, { mx: 1, my: 0 });
    expect(w.strikes.list[0].kind).toBe("dragon");
    expect(w.strikes.list[0].dmg).toBeCloseTo(w.atk * 1 + w.rune.strikeDmg, 5);
  });
  it("時計ねこ: スキルが無くても 来る。またたびの小袋: 床に またたびが出て、拾うと 5匹", () => {
    const t = world({ rune: ["timeSword", G.epic] });
    place(t, 3);
    t.step(1 / 60, { mx: 1, my: 0 });
    expect(t.strikes.list.length).toBe(1);
    const p = world({ rune: ["potion", G.epic] });
    place(p, 3);
    for (let i = 0; i < 60 * 7 && !p.strikes.pickups.length; i++) p.step(1 / 60, { mx: 0.0001, my: 0 });
    expect(p.strikes.pickups.length).toBe(1);
    const pk = p.strikes.pickups[0];
    p.hero.x = pk.x; p.hero.y = pk.y;
    p.step(1 / 60, { mx: 0.0001, my: 0 });
    expect(p.strikes.list.length).toBe(5);
  });
  it("レーザー好きのねこ: ほかの助っ人ねこも レーザーを撃つ（ならんだ敵 ぜんぶ）", () => {
    const w = world({ skills: { s_instant: 1, s_beam: 1 } });
    const a = place(w, 3);
    const b = w.enemies[1]; b.x = w.hero.x; b.y = w.hero.y - 6;
    for (let i = 0; i < 120; i++) w.step(1 / 60, { mx: 1, my: 0 });
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
  });
});
