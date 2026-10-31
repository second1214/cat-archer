import { describe, expect, it } from "vitest";
import { canGodforge, CRYSTALS_PER_CHAOS, descentOf, godforge } from "../src/core/godforge";
import { mulberry32 } from "../src/core/rng";
import { dismantleItem } from "../src/core/run";
import { loadoutOf, newSave, normalize } from "../src/core/save";
import { World } from "../src/game/world";

const set = (gf: number[]) => {
  const s = newSave();
  const ids = ["hw_lantern", "hw_mantle", "hw_hat", "hw_collar", "hw_charm"];
  s.items = ids.map((id, i) => ({ uid: i + 1, id, r: 10 as const, lv: 1, gf: gf[i] }));
  s.equipped = { weapon: 1, clothes: 2, hat: 3, collar: 4, charm: 5 };
  return s;
};

describe("神鍛", () => {
  it("ミシック+3 以上の シリーズ装備だけ。材料を 使って ★が 上がり、攻撃力・体力 +10%", () => {
    const s = newSave();
    s.items = [{ uid: 1, id: "hw_lantern", r: 7, lv: 1 }, { uid: 2, id: "hw_lantern", r: 8, lv: 1 }, { uid: 3, id: "keedama", r: 10, lv: 1 }];
    expect(canGodforge(s.items[0])).toBe(false);
    expect(canGodforge(s.items[2])).toBe(false);
    s.essence = 500; s.crystals = { halloween: 15 };
    expect(godforge(s, 2)).toBe(true);
    expect(godforge(s, 2)).toBe(true);
    expect(godforge(s, 2)).toBe(false);
    expect(s.items[1].gf).toBe(2);
    expect(s.essence).toBe(0);
    s.equipped = { weapon: 2 };
    const a = loadoutOf(s), b = (() => { s.items[1].gf = 0; return loadoutOf(s); })();
    expect(a.atk / b.atk).toBeGreaterThan(1.05);
    expect(normalize(JSON.parse(JSON.stringify({ ...s, items: [{ ...s.items[1], gf: 2 }] }))).items[0].gf).toBe(2);
  });
  it("分解: ふつうは エッセンス、カオスの シリーズは 結晶", () => {
    const s = newSave();
    s.items = [{ uid: 1, id: "keedama", r: 3, lv: 1 }, { uid: 2, id: "hw_hat", r: 10, lv: 1 }];
    s.equipped = {};
    dismantleItem(s, 1); dismantleItem(s, 2);
    expect(s.essence).toBe(27);
    expect(s.crystals.halloween).toBe(CRYSTALS_PER_CHAOS);
  });
  it("降臨: 武器 ★5 のときだけ。帽子・お守りの ★5 が 効果を足す", () => {
    expect(descentOf(set([4, 5, 5, 5, 5]).items)).toBeNull();
    const d = descentOf(set([5, 0, 5, 0, 5]).items)!;
    expect(d.family).toBe("main");
    expect(d.duration).toBe(15);
    expect(d.critDmg).toBeCloseTo(0.6);
    expect(d.shield).toBe(0);
  });
  it("戦いで たまり、10で 降臨。降臨中は ダメージが上がる", () => {
    const w = new World(loadoutOf(set([5, 5, 5, 5, 5])), 1, mulberry32(1));
    for (const e of w.enemies) { e.def = { ...e.def, ai: "turret", speed: 0, shot: 0 }; e.t = 99; e.hp = e.maxHp = 1e9; }
    expect(w.famMul("main")).toBe(1);
    for (let i = 0; i < 60 * 15 && !w.descending; i++) w.step(1 / 60, { mx: 0, my: 0 });
    expect(w.descending).toBe(true);
    expect(w.famMul("main")).toBeCloseTo(1.3);
    expect(w.hero.inv).toBeGreaterThan(0);
  });
});
