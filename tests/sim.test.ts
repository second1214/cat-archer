// バランスの目安（よけ方の へたな ボット）。人なら これより先へ行ける。
import { describe, expect, it } from "vitest";
import { loadoutOf, newSave } from "../src/core/save";
import { runBot } from "./bot";

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

describe("バランスの目安", () => {
  it("はじめの装備: 最初のボス（5）までは とどき、1章クリアは ときどき", () => {
    const lo = loadoutOf(newSave());
    const rs = seeds.map((s) => runBot(lo, 1, s));
    expect(rs.every((r) => r.stage >= 5)).toBe(true);
    expect(rs.filter((r) => r.state === "won").length).toBeLessThanOrEqual(seeds.length / 2);
  });
  it("装備を育てると 1章は ほぼクリアできる", () => {
    const s = newSave();
    s.items = [{ uid: 1, id: "keedama", r: 1, lv: 12 }, { uid: 2, id: "akai", r: 1, lv: 12 }];
    const rs = seeds.map((x) => runBot(loadoutOf(s), 1, x));
    expect(rs.filter((r) => r.state === "won").length).toBeGreaterThanOrEqual(seeds.length * 0.75);
  });
});
