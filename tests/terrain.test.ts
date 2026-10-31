import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/core/rng";
import { ENEMIES, stageInfo } from "../src/core/stages";
import { ALL_LAYOUTS, BLOCK, COLS, FLOOR, ROWS, Terrain } from "../src/core/terrain";
import { loadoutOf, newSave } from "../src/core/save";
import { World } from "../src/game/world";

describe("地形", () => {
  it("どの部屋も 猫の入口から 扉まで歩けて、床はぜんぶ つながっている", () => {
    for (const rows of ALL_LAYOUTS) for (const mirror of [false, true]) {
      const t = Terrain.parse(rows, mirror);
      const d = t.flow(4.5, 13.5);
      expect(d[0 * COLS + 4]).not.toBe(Infinity);
      for (let i = 0; i < COLS * ROWS; i++) if (t.tiles[i] === FLOOR) expect(d[i]).not.toBe(Infinity);
      // 入口（下3段）と 扉の前（上のまん中）は 床
      for (let r = 12; r < ROWS; r++) for (let c = 0; c < COLS; c++) expect(t.at(c, r)).toBe(FLOOR);
      for (const c of [3, 4, 5]) expect(t.at(c, 0)).toBe(FLOOR);
    }
  });
  it("弾は物で止まり、水は通る", () => {
    const t = Terrain.parse(ALL_LAYOUTS[3]); // 横に流れる水
    expect(t.clearShot(0.5, 3, 0.5, 7)).toBe(true);
    const b = Terrain.parse(ALL_LAYOUTS[1]); // 柱
    expect(b.at(2, 3)).toBe(BLOCK);
    expect(b.clearShot(2.5, 1, 2.5, 6)).toBe(false);
  });
  it("地面の虫は 物・水の上に出てこない", () => {
    const lo = loadoutOf(newSave());
    for (let seed = 1; seed < 30; seed++) {
      const w = new World(lo, 4, mulberry32(seed));
      for (let st = 2; st <= 9; st++) {
        w.startStage(st);
        for (const e of w.enemies) if (!e.def.fly) expect(w.terrain.hits(e.x, e.y, e.def.r)).toBe(false);
      }
    }
  });
});

describe("章ごとの虫", () => {
  it("2章から ゴキブリ、3章から 蚊、4章から 毛虫。ボスは 章で かわる", () => {
    const kinds = (ch: number) => new Set(Array.from({ length: 10 }, (_, i) => stageInfo(ch, i + 1).enemies).flat());
    expect(kinds(1).has("gokiburi")).toBe(false);
    expect(kinds(2).has("gokiburi")).toBe(true);
    expect(kinds(3).has("ka")).toBe(true);
    expect(kinds(4).has("kemushi")).toBe(true);
    const boss = (ch: number) => stageInfo(ch, 5).enemies.find((k) => ENEMIES[k].boss);
    expect(new Set([boss(1), boss(2), boss(3)]).size).toBe(3);
  });
  it("毛虫は たおすと 2匹に分かれる", () => {
    const w = new World(loadoutOf(newSave()), 4, mulberry32(1));
    w.startStage(9);
    const k = w.enemies.find((e) => e.def.kind === "kemushi")!;
    const before = w.enemies.length;
    k.hp = 1;
    // 毛虫を いちばん近くにして 撃たせる
    for (const e of w.enemies) if (e !== k) { e.x = 0.5; e.y = 0.5; }
    k.x = w.hero.x; k.y = w.hero.y - 3;
    for (let i = 0; i < 120 && w.enemies.includes(k); i++) w.step(1 / 60, { mx: 0, my: 0 });
    expect(w.enemies.filter((e) => e.def.kind === "kemushiko").length).toBe(2);
    expect(w.enemies.length).toBe(before + 1);
  });
});

describe("章の作り込み", () => {
  it("章ごとに 顔ぶれが ちがい、新しい虫は その章から 出る。全部の虫が どこかで出る", async () => {
    const { chapterRoster, stageInfo, ENEMIES, CHAPTER_COUNT } = await import("../src/core/stages");
    const sig = (ch: number) => Array.from({ length: 10 }, (_, i) => stageInfo(ch, i + 1).enemies.join()).join("|");
    const sigs = new Set(Array.from({ length: CHAPTER_COUNT }, (_, i) => sig(i + 1)));
    expect(sigs.size).toBe(CHAPTER_COUNT);
    const seen = new Set<string>();
    for (let ch = 1; ch <= CHAPTER_COUNT; ch++) for (let s = 1; s <= 10; s++) for (const k of stageInfo(ch, s).enemies) {
      expect(ENEMIES[k].from ?? 1).toBeLessThanOrEqual(ch);
      seen.add(k);
    }
    for (const k of Object.keys(ENEMIES)) if (k !== "kemushiko") expect(seen.has(k)).toBe(true);
    expect(chapterRoster(15)).toContain("kabuto");
    expect(stageInfo(30, 5).enemies.length).toBeGreaterThan(1); // ボスに 子分
  });
});
