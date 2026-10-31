import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/core/rng";
import { loadoutOf, newSave } from "../src/core/save";
import { LASER_USELESS, rollSkills } from "../src/core/skills";
import { World } from "../src/game/world";

/** 1面（何もない部屋）で、敵を決まった場所に置いて 1回撃たせる */
function setup(opts: { laserWeapon?: boolean; skills?: Record<string, number> } = {}) {
  const s = newSave();
  if (opts.laserWeapon) { s.items.push({ uid: 9, id: "laser", r: 0, lv: 1 }); s.equipped.weapon = 9; }
  const w = new World(loadoutOf(s), 1, mulberry32(1));
  Object.assign(w.skills, opts.skills ?? {});
  const [a, b, c] = w.enemies;
  // 猫の まっすぐ上に 2匹ならべる（3匹めは 遠くのすみ）
  a.x = w.hero.x; a.y = w.hero.y - 3; b.x = w.hero.x; b.y = w.hero.y - 6; c.x = 0.5; c.y = 0.5;
  for (const e of w.enemies) { e.def = { ...e.def, ai: "turret", speed: 0 }; e.t = 99; e.hp = e.maxHp = 1e6; }
  w.hero.atkCd = 0;
  w.step(1 / 60, { mx: 0, my: 0 });
  return { w, a, b };
}

describe("撃ち方", () => {
  it("ななめ＋まえに2本: ななめの毛玉も 2本ずつになる", () => {
    expect(setup({ skills: { diag: 1 } }).w.shots.length).toBe(3);
    expect(setup({ skills: { diag: 1, front: 1 } }).w.shots.length).toBe(6);
    expect(setup({ skills: { diag: 1, side: 1, front: 2 } }).w.shots.length).toBe(15);
  });
  it("レーザーポインター（武器）: 毛玉を撃たず、ならんだ敵 ぜんぶに 一度に当たる", () => {
    const { w, a, b } = setup({ laserWeapon: true });
    expect(w.shots.length).toBe(0);
    expect(w.beams.length).toBe(1);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
  });
  it("レーザーポインター（スキル）: 毛玉に くわえて レーザーも撃つ", () => {
    const { w, b } = setup({ skills: { laser: 1 } });
    expect(w.shots.length).toBe(1);
    expect(w.beams.filter((x) => x.extra).length).toBe(1);
    expect(b.hp).toBeLessThan(1e6);
  });
  it("レーザーは 物で止まる", () => {
    const s = newSave(); s.items.push({ uid: 9, id: "laser", r: 0, lv: 1 }); s.equipped.weapon = 9;
    const w = new World(loadoutOf(s), 1, mulberry32(1));
    w.terrain.tiles[10 * 9 + 4] = 1; // 猫の 3マス上に 物
    const [a, b, c] = w.enemies;
    a.x = w.hero.x; a.y = 8; b.x = 0.5; b.y = 0.5; c.x = 8.5; c.y = 0.5;
    for (const e of w.enemies) { e.def = { ...e.def, ai: "turret", speed: 0 }; e.t = 99; e.hp = e.maxHp = 1e6; }
    w.hero.atkCd = 0;
    w.step(1 / 60, { mx: 0, my: 0 });
    expect(a.hp).toBe(1e6);
  });
  it("ゆうどう: 毛玉が 横にずれた敵へ 曲がる", () => {
    const run = (homing: boolean) => {
      const { w, a } = setup({ skills: homing ? { homing: 1 } : {} });
      const s = w.shots[0];
      a.x += 1.5; // 撃ったあとで 敵が横へ
      for (let i = 0; i < 20; i++) w.step(1 / 60, { mx: 1, my: 0 });
      return s.vx;
    };
    expect(run(false)).toBeCloseTo(0, 5);
    expect(run(true)).toBeGreaterThan(1);
  });
  it("レーザーの武器では 毛玉だけのスキル（つらぬく・はねる・とびうつる・ゆうどう）は 出ない", () => {
    for (let i = 0; i < 200; i++) {
      const r = rollSkills({}, mulberry32(i), 3, false, true);
      expect(r.some((x) => LASER_USELESS.includes(x))).toBe(false);
    }
  });
});
