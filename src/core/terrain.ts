// 部屋の地形。1マス = 1単位、横9×縦15。
// "#" 物（体も弾も通らない） "~" 水たまり（体は通らない・弾は通る） "." 床
// 上のまん中は 扉、下の3段は 猫が入ってくる所なので あけておく。
import type { Rng } from "./rng";

export const COLS = 9;
export const ROWS = 15;
export type Tile = 0 | 1 | 2; // 床・物・水
export const FLOOR = 0, BLOCK = 1, WATER = 2;

const EMPTY = Array.from({ length: ROWS }, () => ".........");

const LAYOUTS: readonly string[][] = [
  [ // 柱
    ".........", ".........", ".........", "..#...#..", "..#...#..", ".........", ".........", "....#....",
    ".........", "..#...#..", "..#...#..", ".........", ".........", ".........", ".........",
  ],
  [ // まん中の大きな物
    ".........", ".........", ".........", ".........", "...###...", "...###...", ".........", ".........",
    ".#.....#.", ".#.....#.", ".........", ".........", ".........", ".........", ".........",
  ],
  [ // 横に流れる水
    ".........", ".........", ".........", ".........", "~~~...~~~", "~~~...~~~", ".........", ".........",
    ".........", "..#...#..", ".........", ".........", ".........", ".........", ".........",
  ],
  [ // かべと水
    ".........", ".........", ".##...##.", ".........", ".........", "....~....", "...~~~...", "....~....",
    ".........", ".........", ".##...##.", ".........", ".........", ".........", ".........",
  ],
  [ // 通り道
    ".........", ".........", ".........", "###...###", ".........", ".........", ".........", ".........",
    "...###...", ".........", ".........", ".........", ".........", ".........", ".........",
  ],
  [ // 池
    ".........", ".........", ".#.....#.", ".........", "...~~~...", "..~~~~~..", "...~~~...", ".........",
    ".#.....#.", ".........", ".........", ".........", ".........", ".........", ".........",
  ],
  [ // じぐざぐ
    ".........", ".........", ".........", ".####....", ".........", ".........", "....####.", ".........",
    ".........", ".####....", ".........", ".........", ".........", ".........", ".........",
  ],
  [ // ちらばり
    ".........", ".........", "..#......", "......#..", ".........", ".#...~~..", ".....~~..", ".........",
    "...#.....", ".......#.", ".........", ".........", ".........", ".........", ".........",
  ],
];

const BOSS_LAYOUT = [
  ".........", ".........", ".#.....#.", ".........", ".........", ".........", ".........", ".........",
  ".........", ".........", ".#.....#.", ".........", ".........", ".........", ".........",
];

export const ALL_LAYOUTS: readonly string[][] = [EMPTY, ...LAYOUTS, BOSS_LAYOUT];

export class Terrain {
  constructor(readonly tiles: Tile[]) {}

  static parse(rows: readonly string[], mirror = false): Terrain {
    const t: Tile[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = rows[r][mirror ? COLS - 1 - c : c];
        t.push(ch === "#" ? BLOCK : ch === "~" ? WATER : FLOOR);
      }
    }
    return new Terrain(t);
  }

  static empty(): Terrain { return Terrain.parse(EMPTY); }

  at(c: number, r: number): Tile {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return BLOCK;
    return this.tiles[r * COLS + c];
  }

  /** 体が通れないマスか（空を飛ぶ虫は 通れる） */
  solid(c: number, r: number, flying = false): boolean {
    return !flying && this.at(c, r) !== FLOOR;
  }

  /** 円（足もと）が 通れないマスに かかっているか */
  hits(x: number, y: number, rad: number, flying = false): boolean {
    if (flying) return false;
    for (let r = Math.floor(y - rad); r <= Math.floor(y + rad); r++) {
      for (let c = Math.floor(x - rad); c <= Math.floor(x + rad); c++) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
        if (this.at(c, r) === FLOOR) continue;
        const nx = Math.max(c, Math.min(x, c + 1)), ny = Math.max(r, Math.min(y, r + 1));
        if ((x - nx) ** 2 + (y - ny) ** 2 < rad * rad) return true;
      }
    }
    return false;
  }

  /** 弾が 物に当たるか（水は通る） */
  blocksShot(x: number, y: number): boolean {
    const c = Math.floor(x), r = Math.floor(y);
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && this.at(c, r) === BLOCK;
  }

  /** 2点のあいだに 物があるか（弾が通るか） */
  clearShot(x1: number, y1: number, x2: number, y2: number): boolean {
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.25);
    for (let i = 1; i < n; i++) {
      if (this.blocksShot(x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n)) return false;
    }
    return true;
  }

  /** (tx,ty) までの 歩いて行ける距離（マスごと。行けないマスは Infinity） */
  flow(tx: number, ty: number): number[] {
    const d = new Array<number>(COLS * ROWS).fill(Infinity);
    const sc = Math.max(0, Math.min(COLS - 1, Math.floor(tx))), sr = Math.max(0, Math.min(ROWS - 1, Math.floor(ty)));
    d[sr * COLS + sc] = 0;
    const q = [sr * COLS + sc];
    for (let i = 0; i < q.length; i++) {
      const cur = q[i], c = cur % COLS, r = (cur - c) / COLS;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (this.solid(nc, nr)) continue;
        const k = nr * COLS + nc;
        if (d[k] !== Infinity) continue;
        d[k] = d[cur] + 1;
        q.push(k);
      }
    }
    return d;
  }

  /** 距離の地図にそって、(x,y) から 1歩 進む向き（となりのマスの まん中へ）。行き止まりなら null */
  stepDir(field: number[], x: number, y: number): [number, number] | null {
    const c = Math.floor(x), r = Math.floor(y);
    const here = field[r * COLS + c] ?? Infinity;
    let best: [number, number] | null = null, bd = here;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (this.solid(nc, nr)) continue;
      // ななめは 角を けずらない
      if (dc && dr && (this.solid(c + dc, r) || this.solid(c, r + dr))) continue;
      const v = field[nr * COLS + nc] + (dc && dr ? 0.4 : 0);
      if (v < bd) { bd = v; best = [nc + 0.5 - x, nr + 0.5 - y]; }
    }
    if (!best) return null;
    const m = Math.hypot(best[0], best[1]) || 1;
    return [best[0] / m, best[1] / m];
  }
}

/** ステージの地形をえらぶ（1面は 何もない、ボス面は 四すみに物）。 */
export function pickTerrain(stage: number, boss: boolean, rng: Rng): Terrain {
  if (stage === 1) return Terrain.empty();
  if (boss) return Terrain.parse(BOSS_LAYOUT);
  const rows = LAYOUTS[Math.floor(rng() * LAYOUTS.length)];
  return Terrain.parse(rows, rng() < 0.5);
}
