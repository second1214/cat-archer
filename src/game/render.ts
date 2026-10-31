// 戦闘の絵（canvas）。猫は PNG、虫は コードで描く。
import { BLOCK, COLS, WATER, type Terrain } from "../core/terrain";
import { DOOR_W, H, W, type Enemy, type World } from "./world";

/** 章ごとの 部屋の見た目 */
type FloorKind = "plank" | "tile" | "carpet" | "grass" | "stone";
type BlockKind = "box" | "shelf" | "bucket" | "toy" | "crate" | "plant" | "trunk" | "barrel" | "rock";
interface Theme { floor: FloorKind; f1: string; f2: string; line: string; wall: string; wallTop: string; block: BlockKind; b1: string; b2: string; water: string }
const THEMES: Theme[] = [
  { floor: "plank", f1: "#e2bf8f", f2: "#ddb685", line: "rgba(120,80,40,.18)", wall: "#c9a27a", wallTop: "#a57b55", block: "box", b1: "#d9a866", b2: "#b98546", water: "#8fc8e8" },
  { floor: "tile", f1: "#f3ede2", f2: "#e4dccd", line: "rgba(120,100,80,.18)", wall: "#d7c9b0", wallTop: "#b7a585", block: "shelf", b1: "#c08a5a", b2: "#9a6a40", water: "#9fd0ec" },
  { floor: "tile", f1: "#d6ecf5", f2: "#c3e1ee", line: "rgba(60,110,140,.2)", wall: "#a9d0df", wallTop: "#7fb2c6", block: "bucket", b1: "#f2b84b", b2: "#d39222", water: "#6fb6e0" },
  { floor: "carpet", f1: "#f4cdd6", f2: "#efc1cc", line: "rgba(160,80,100,.12)", wall: "#e8b3c0", wallTop: "#cf8fa1", block: "toy", b1: "#6fb0e0", b2: "#4a85b8", water: "#8fc8e8" },
  { floor: "stone", f1: "#c9c4bb", f2: "#bdb7ad", line: "rgba(60,55,50,.2)", wall: "#9d968b", wallTop: "#7c766c", block: "crate", b1: "#c79a5e", b2: "#9c733e", water: "#7fb0c8" },
  { floor: "grass", f1: "#9fd07a", f2: "#93c66d", line: "rgba(60,110,40,.18)", wall: "#c9b48a", wallTop: "#a8916a", block: "plant", b1: "#5fae4a", b2: "#c7744a", water: "#5fa8d8" },
  { floor: "plank", f1: "#a9825c", f2: "#9f7a55", line: "rgba(50,30,15,.25)", wall: "#7d5c40", wallTop: "#5e432d", block: "trunk", b1: "#8a5a3a", b2: "#5e3a22", water: "#6f9cb8" },
  { floor: "stone", f1: "#8e8f94", f2: "#84858a", line: "rgba(20,20,30,.25)", wall: "#5f6066", wallTop: "#45464c", block: "barrel", b1: "#9c6e45", b2: "#6e4a2a", water: "#4f7fa0" },
  { floor: "plank", f1: "#d9a58c", f2: "#cf9a80", line: "rgba(110,50,30,.18)", wall: "#b98a76", wallTop: "#946652", block: "box", b1: "#e2b77a", b2: "#bf8f50", water: "#8fc8e8" },
  { floor: "grass", f1: "#b5dc86", f2: "#a9d27c", line: "rgba(70,120,40,.16)", wall: "#d9c79c", wallTop: "#bba77a", block: "rock", b1: "#b3aea6", b2: "#8a857d", water: "#5fb0e0" },
];
export const themeOf = (chapter: number): Theme => THEMES[(chapter - 1) % THEMES.length];

// 移動は 走りの4コマ（歩きの4コマは 足の動きが小さく、すべって見えるため）
const CAT_FRAMES = ["walk1", "run1", "run2", "run3", "run4", "shoot", "hurt", "jump", "sit"] as const;
type CatFrame = (typeof CAT_FRAMES)[number];
/** 猫の絵の 1マスあたりのピクセル（歩きの絵の高さ 177px ≒ 1.45マス） */
const CAT_PX = 122;

const imgs = new Map<CatFrame, HTMLImageElement>();
let loadedCat = "";
/** 主人公の猫の絵を読む（ちがう猫にしたら 入れかえる）。 */
export function loadCatImages(cat: string): Promise<void> {
  if (cat === loadedCat) return Promise.resolve();
  loadedCat = cat;
  imgs.clear();
  return Promise.all(CAT_FRAMES.map((f) => new Promise<void>((ok) => {
    const im = new Image();
    im.onload = () => { if (loadedCat === cat) imgs.set(f, im); ok(); };
    im.onerror = () => ok();
    im.src = `cat/${cat}/${f}.png`;
  }))).then(() => undefined);
}

export interface Stick { active: boolean; ox: number; oy: number; x: number; y: number }

const WALL = 0.45;
let floorCache: { key: string; cv: HTMLCanvasElement } | null = null;

export class Renderer {
  private g: CanvasRenderingContext2D;
  s = 40;           // 1マスのピクセル（CSS）
  ox = 0; oy = 0;   // 部屋の左上（CSS ピクセル）
  constructor(readonly cv: HTMLCanvasElement) {
    this.g = cv.getContext("2d")!;
  }

  resize(): void {
    const r = this.cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(r.width * dpr);
    this.cv.height = Math.round(r.height * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 上は HUD、下は 指の分を あける
    const top = 64, bottom = 24;
    this.s = Math.min((r.width - 12) / (W + WALL * 2), (r.height - top - bottom) / (H + WALL * 2));
    this.ox = (r.width - W * this.s) / 2;
    this.oy = top + (r.height - top - bottom - H * this.s) / 2;
    floorCache = null;
  }

  private X(x: number) { return this.ox + x * this.s; }
  private Y(y: number) { return this.oy + y * this.s; }

  draw(w: World, stick: Stick): void {
    const g = this.g, s = this.s;
    const r = this.cv.getBoundingClientRect();
    g.fillStyle = "#3b2a20";
    g.fillRect(0, 0, r.width, r.height);
    this.drawRoom(w);
    // 奥から順に
    const items: { y: number; f: () => void }[] = [];
    for (const e of w.enemies) items.push({ y: e.y, f: () => this.drawEnemy(e, w.time) });
    // 物は 下のふちの高さで 前後をきめる（猫が うしろに かくれる）
    const th = themeOf(w.chapter);
    w.terrain.tiles.forEach((t, i) => {
      if (t !== BLOCK) return;
      const c = i % COLS, r = (i - c) / COLS;
      items.push({ y: r + 1, f: () => this.drawBlock(th, c, r, w.terrain) });
    });
    items.push({ y: w.hero.y, f: () => this.drawHero(w) });
    items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
    // レーザー
    for (const b of w.beams) {
      const a = 1 - b.t / 0.14;
      g.lineCap = "round";
      g.strokeStyle = `rgba(255,40,60,${0.35 * a})`;
      g.lineWidth = s * (b.extra ? 0.22 : 0.3);
      g.beginPath(); g.moveTo(this.X(b.x1), this.Y(b.y1)); g.lineTo(this.X(b.x2), this.Y(b.y2)); g.stroke();
      g.strokeStyle = b.crit ? `rgba(255,240,120,${a})` : `rgba(255,220,225,${a})`;
      g.lineWidth = s * (b.extra ? 0.06 : 0.09);
      g.beginPath(); g.moveTo(this.X(b.x1), this.Y(b.y1)); g.lineTo(this.X(b.x2), this.Y(b.y2)); g.stroke();
      g.fillStyle = `rgba(255,80,90,${a})`;
      g.beginPath(); g.arc(this.X(b.x2), this.Y(b.y2), s * 0.12, 0, Math.PI * 2); g.fill();
    }
    // 毛玉
    for (const sh of w.shots) {
      const col = w.skills.fire ? "#ff8a3d" : w.skills.ice ? "#7fd8ff" : w.skills.poison ? "#8fd36a" : "#ff8fb8";
      yarn(g, this.X(sh.x), this.Y(sh.y), s * (sh.crit ? 0.2 : 0.15), col);
    }
    for (const [x, y] of w.orbPositions()) yarn(g, this.X(x), this.Y(y), s * 0.24, "#b48cff");
    // 敵の弾
    for (const e of w.eshots) {
      const x = this.X(e.x), y = this.Y(e.y), rr = e.r * s;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr * 1.6);
      gr.addColorStop(0, "#fff"); gr.addColorStop(0.35, "#ff5a7a"); gr.addColorStop(1, "rgba(160,20,60,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, rr * 1.6, 0, Math.PI * 2); g.fill();
    }
    this.drawFx(w);
    if (stick.active) {
      g.globalAlpha = 0.35;
      g.fillStyle = "#fff";
      g.beginPath(); g.arc(stick.ox, stick.oy, 46, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.7;
      g.beginPath(); g.arc(stick.x, stick.y, 22, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
  }

  private drawRoom(w: World): void {
    const g = this.g, s = this.s;
    const key = `${s}:${this.ox}:${this.oy}:${w.chapter}:${w.stage}`;
    if (!floorCache || floorCache.key !== key) floorCache = { key, cv: this.makeFloor(themeOf(w.chapter), w.terrain) };
    const dpr = this.cv.width / this.cv.getBoundingClientRect().width;
    g.drawImage(floorCache.cv, 0, 0, floorCache.cv.width / dpr, floorCache.cv.height / dpr);
    // 扉（上のまん中）
    const dx = this.X(W / 2 - DOOR_W / 2), dw = DOOR_W * s, dy = this.Y(-WALL);
    if (w.state === "clear") {
      const gr = g.createLinearGradient(0, dy, 0, dy + WALL * s * 2.2);
      gr.addColorStop(0, "rgba(255,240,180,1)"); gr.addColorStop(1, "rgba(255,240,180,0)");
      g.fillStyle = gr;
      g.fillRect(dx, dy, dw, WALL * s * 2.2);
      // 矢印
      const t = (w.time * 2) % 1;
      g.fillStyle = `rgba(255,255,255,${0.9 - t * 0.6})`;
      const ay = this.Y(1.2 - t * 0.5), ax = this.X(W / 2);
      g.beginPath(); g.moveTo(ax, ay - s * 0.35); g.lineTo(ax + s * 0.35, ay + s * 0.05); g.lineTo(ax - s * 0.35, ay + s * 0.05); g.fill();
    } else {
      g.fillStyle = "#6b4226";
      g.fillRect(dx, dy, dw, WALL * s);
      g.fillStyle = "#e0b45a";
      g.beginPath(); g.arc(dx + dw * 0.78, dy + WALL * s * 0.55, s * 0.06, 0, Math.PI * 2); g.fill();
    }
  }

  private makeFloor(th: Theme, terrain: Terrain): HTMLCanvasElement {
    const dpr = this.cv.width / this.cv.getBoundingClientRect().width;
    const cv = document.createElement("canvas");
    cv.width = this.cv.width; cv.height = this.cv.height;
    const g = cv.getContext("2d")!;
    g.scale(dpr, dpr);
    const s = this.s, x0 = this.X(0), y0 = this.Y(0);
    // 壁
    g.fillStyle = th.wall;
    g.fillRect(x0 - WALL * s, y0 - WALL * s, (W + WALL * 2) * s, (H + WALL * 2) * s);
    g.fillStyle = th.wallTop;
    g.fillRect(x0 - WALL * s, y0 - WALL * s, (W + WALL * 2) * s, WALL * s);
    // 床
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    switch (th.floor) {
      case "plank": {
        const plank = 0.75;
        for (let i = 0; i * plank < H; i++) {
          g.fillStyle = i % 2 ? th.f1 : th.f2;
          g.fillRect(x0, y0 + i * plank * s, W * s, plank * s);
          g.fillStyle = th.line;
          g.fillRect(x0, y0 + i * plank * s, W * s, 1.2);
          const off = (i * 2.3) % 3;
          for (let k = off; k < W; k += 3) g.fillRect(x0 + k * s, y0 + i * plank * s, 1.2, plank * s);
        }
        break;
      }
      case "tile": {
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
          g.fillStyle = (r + c) % 2 ? th.f1 : th.f2;
          g.fillRect(x0 + c * s, y0 + r * s, s, s);
        }
        g.fillStyle = th.line;
        for (let r = 0; r <= H; r++) g.fillRect(x0, y0 + r * s, W * s, 1.2);
        for (let c = 0; c <= W; c++) g.fillRect(x0 + c * s, y0, 1.2, H * s);
        break;
      }
      case "carpet": {
        g.fillStyle = th.f1; g.fillRect(x0, y0, W * s, H * s);
        g.fillStyle = th.line;
        for (let i = 0; i < 900; i++) g.fillRect(x0 + rnd() * W * s, y0 + rnd() * H * s, 1.5, 1.5);
        g.strokeStyle = th.f2; g.lineWidth = s * 0.12;
        g.strokeRect(x0 + s * 0.6, y0 + s * 0.6, (W - 1.2) * s, (H - 1.2) * s);
        break;
      }
      case "grass": {
        g.fillStyle = th.f1; g.fillRect(x0, y0, W * s, H * s);
        for (let i = 0; i < 500; i++) {
          g.fillStyle = rnd() < 0.5 ? th.f2 : th.line;
          const x = x0 + rnd() * W * s, y = y0 + rnd() * H * s;
          g.fillRect(x, y, 1.5, 4);
        }
        break;
      }
      case "stone": {
        g.fillStyle = th.f1; g.fillRect(x0, y0, W * s, H * s);
        for (let r = 0; r < H; r++) {
          const off = r % 2 ? 0.5 : 0;
          for (let c = -off; c < W; c += 1) {
            g.fillStyle = rnd() < 0.5 ? th.f1 : th.f2;
            g.fillRect(x0 + Math.max(0, c) * s + 1, y0 + r * s + 1, (Math.min(W, c + 1) - Math.max(0, c)) * s - 2, s - 2);
          }
        }
        break;
      }
    }
    // 水たまり（となりと つながって見えるよう、少し はみ出して 角を丸める）
    terrain.tiles.forEach((t, i) => {
      if (t !== WATER) return;
      const c = i % COLS, r = (i - c) / COLS;
      g.fillStyle = th.water;
      roundRect(g, x0 + (c - 0.06) * s, y0 + (r - 0.06) * s, s * 1.12, s * 1.12, s * 0.3);
      g.fill();
    });
    terrain.tiles.forEach((t, i) => {
      if (t !== WATER) return;
      const c = i % COLS, r = (i - c) / COLS;
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.5;
      g.beginPath(); g.arc(x0 + (c + 0.35) * s, y0 + (r + 0.4) * s, s * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.beginPath(); g.arc(x0 + (c + 0.68) * s, y0 + (r + 0.7) * s, s * 0.1, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    });
    // ふちの影
    const gr = g.createLinearGradient(0, y0, 0, y0 + s * 0.8);
    gr.addColorStop(0, "rgba(60,30,10,.25)"); gr.addColorStop(1, "rgba(60,30,10,0)");
    g.fillStyle = gr; g.fillRect(x0, y0, W * s, s * 0.8);
    return cv;
  }

  /** 物を1つ 描く（上の面と 前の面。上下・左右に となりがあれば つなげる） */
  private drawBlock(th: Theme, c: number, r: number, t: Terrain): void {
    const g = this.g, s = this.s;
    const hgt = th.block === "plant" || th.block === "rock" ? 0.35 : 0.5;
    const x = this.X(c), y = this.Y(r), topY = y - hgt * s;
    const down = t.at(c, r + 1) === BLOCK;
    const toyCol = ["#6fb0e0", "#f08a8a", "#f3c454", "#86cf7a"][(c * 7 + r * 3) % 4];
    const b1 = th.block === "toy" ? toyCol : th.b1;
    // 影
    g.fillStyle = "rgba(40,20,10,.22)";
    g.fillRect(x + s * 0.08, y + s * 0.08, s, s * (down ? 1 : 0.95));
    if (th.block === "plant") {
      // 鉢と しげみ
      g.fillStyle = th.b2;
      g.fillRect(x + s * 0.2, y + s * 0.35, s * 0.6, s * 0.55);
      g.fillStyle = b1;
      for (const [ox, oy, rr] of [[0.3, 0.25, 0.3], [0.7, 0.25, 0.3], [0.5, 0.05, 0.34], [0.5, 0.4, 0.3]]) {
        g.beginPath(); g.arc(x + ox * s, topY + oy * s + s * 0.3, rr * s, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = "rgba(255,255,255,.18)";
      g.beginPath(); g.arc(x + s * 0.4, topY + s * 0.2, s * 0.14, 0, Math.PI * 2); g.fill();
      return;
    }
    if (th.block === "rock") {
      g.fillStyle = th.b2;
      g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.55, s * 0.5, s * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = b1;
      g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.4, s * 0.46, s * 0.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,.25)";
      g.beginPath(); g.ellipse(x + s * 0.35, y + s * 0.25, s * 0.15, s * 0.08, -0.4, 0, Math.PI * 2); g.fill();
      return;
    }
    if (th.block === "bucket" || th.block === "barrel") {
      g.fillStyle = th.b2;
      g.fillRect(x + s * 0.1, topY + s * 0.25, s * 0.8, (hgt + 0.7) * s);
      g.beginPath(); g.ellipse(x + s * 0.5, y + s * 0.95, s * 0.4, s * 0.12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = b1;
      g.beginPath(); g.ellipse(x + s * 0.5, topY + s * 0.25, s * 0.4, s * 0.16, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 2;
      for (const k of [0.45, 0.8]) { g.beginPath(); g.moveTo(x + s * 0.1, topY + (0.25 + k * (hgt + 0.7)) * s); g.lineTo(x + s * 0.9, topY + (0.25 + k * (hgt + 0.7)) * s); g.stroke(); }
      return;
    }
    // 箱の形（段ボール・たな・つみき・木箱・つづら）。上の面と 前の面（下のマスの物が 前の面に重なって つながる）
    g.fillStyle = b1;
    g.fillRect(x, topY, s, s);
    g.fillStyle = th.b2;
    g.fillRect(x, topY + s, s, hgt * s);
    g.strokeStyle = "rgba(40,20,10,.35)"; g.lineWidth = 1.5;
    g.strokeRect(x + 0.75, topY + 0.75, s - 1.5, s - 1.5 + hgt * s);
    g.fillStyle = "rgba(0,0,0,.18)";
    switch (th.block) {
      case "box": g.fillStyle = "rgba(240,225,190,.7)"; g.fillRect(x + s * 0.44, topY, s * 0.12, s); break;
      case "shelf": g.fillRect(x + s * 0.12, topY + s + hgt * s * 0.45, s * 0.76, 2); g.fillStyle = "#e9d08a"; g.fillRect(x + s * 0.44, topY + s + hgt * s * 0.25, s * 0.12, s * 0.06); break;
      case "toy": g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.arc(x + s * 0.5, topY + s * 0.5, s * 0.22, 0, Math.PI * 2); g.fill(); break;
      case "crate": for (const k of [0.33, 0.66]) g.fillRect(x, topY + s * k, s, 2); g.fillRect(x + s * 0.48, topY, 2, s); break;
      case "trunk": g.fillStyle = "#d8b25a"; g.fillRect(x, topY + s * 0.45, s, s * 0.08); g.fillRect(x + s * 0.44, topY + s + hgt * s * 0.2, s * 0.12, s * 0.14); break;
    }
  }

  private shadow(x: number, y: number, rx: number): void {
    const g = this.g;
    g.fillStyle = "rgba(60,30,10,.22)";
    g.beginPath(); g.ellipse(this.X(x), this.Y(y), rx * this.s, rx * this.s * 0.38, 0, 0, Math.PI * 2); g.fill();
  }

  private drawHero(w: World): void {
    const g = this.g, h = w.hero, s = this.s;
    this.shadow(h.x, h.y, 0.55);
    const frame: CatFrame = w.state === "won" ? "jump"
      : h.hurtAnim > 0 ? "hurt"
      : h.moving ? (`run${(Math.floor(h.dist * 3) % 4) + 1}` as CatFrame)
      : h.shootAnim > 0 ? "shoot" : "walk1";
    const im = imgs.get(frame) ?? imgs.get("walk1");
    if (h.inv > 0 && h.hurtAnim <= 0 && Math.floor(w.time * 16) % 2 === 0 && w.state === "fight") g.globalAlpha = 0.55;
    if (im) {
      const dw = (im.width / CAT_PX) * s, dh = (im.height / CAT_PX) * s;
      g.save();
      // 走りは 歩きより 体が低く横長の絵なので 少し大きくし、コマに合わせて 上下にはずませる
      const run = frame.startsWith("run");
      const bob = run ? -Math.abs(Math.sin(h.dist * 3 * Math.PI / 2)) * s * 0.08 : 0;
      g.translate(this.X(h.x), this.Y(h.y) + s * 0.08 + bob);
      if (run) g.scale(1.12, 1.12);
      g.scale(h.facing, 1);
      g.drawImage(im, -dw / 2, -dh, dw, dh);
      g.restore();
    } else {
      g.fillStyle = "#f29b3b";
      g.beginPath(); g.arc(this.X(h.x), this.Y(h.y - 0.4), s * 0.4, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }

  private drawEnemy(e: Enemy, t: number): void {
    const g = this.g, s = this.s, r = e.def.r;
    this.shadow(e.x, e.y, r * 1.35);
    const x = this.X(e.x), y = this.Y(e.y - r * 1.1);
    g.save();
    g.translate(x, y);
    g.scale(e.facing, 1);
    // 突進のため（ぷるぷる）
    if ((e.def.ai === "charge" || e.def.ai === "boss2" || e.def.ai === "boss3") && e.mode === 1) g.translate(Math.sin(t * 60) * s * 0.04, 0);
    drawBug(g, e.def.kind, r * s * 1.3, t + e.id);
    if (e.flash > 0) {
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = `rgba(255,255,255,${e.flash * 5})`;
      g.fillRect(-r * s * 2, -r * s * 2, r * s * 4, r * s * 4);
      g.globalCompositeOperation = "source-over";
    }
    g.restore();
    // 状態の色
    if (e.burn > 0 || e.poison > 0 || e.slow > 0) {
      g.fillStyle = e.burn > 0 ? "rgba(255,120,40,.35)" : e.poison > 0 ? "rgba(120,200,60,.3)" : "rgba(120,210,255,.35)";
      g.beginPath(); g.arc(x, y, r * s * 1.05, 0, Math.PI * 2); g.fill();
    }
    if (!e.def.boss) {
      const bw = Math.max(r * 2.4, 0.7) * s, by = y - r * s * 1.3 - s * 0.3;
      g.fillStyle = "rgba(40,20,10,.6)"; g.fillRect(x - bw / 2, by, bw, 4);
      g.fillStyle = "#ff5a5a"; g.fillRect(x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  private drawFx(w: World): void {
    const g = this.g, s = this.s;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const f of w.fx) {
      const a = 1 - f.t / 0.9;
      const x = this.X(f.x), y = this.Y(f.y) - f.t * s * 0.9;
      if (f.kind === "die") {
        g.fillStyle = `rgba(255,250,235,${a * 0.8})`;
        for (let i = 0; i < 5; i++) {
          const an = i * 1.26, d = (f.v + f.t * 1.4) * s;
          g.beginPath(); g.arc(this.X(f.x) + Math.cos(an) * d, this.Y(f.y) - f.v * s + Math.sin(an) * d * 0.6, s * 0.16 * a, 0, Math.PI * 2); g.fill();
        }
        continue;
      }
      g.globalAlpha = Math.max(0, a);
      const txt = f.kind === "dodge" ? "ひらり" : f.kind === "heal" ? `+${f.v}` : f.kind === "hurt" ? `-${f.v}` : String(f.v);
      const big = f.kind === "crit" ? 1.35 : f.kind === "dot" ? 0.8 : 1;
      g.font = `900 ${Math.round(s * 0.42 * big)}px system-ui, sans-serif`;
      g.lineWidth = 3; g.strokeStyle = "rgba(40,20,10,.85)";
      g.fillStyle = f.kind === "crit" ? "#ffd84a" : f.kind === "heal" ? "#7ee08a" : f.kind === "hurt" ? "#ff6b6b" : f.kind === "dodge" ? "#bfe8ff" : f.kind === "dot" ? "#ffb27a" : "#fff";
      g.strokeText(txt, x, y); g.fillText(txt, x, y);
      g.globalAlpha = 1;
    }
  }
}

function yarn(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string): void {
  g.fillStyle = col;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,255,255,.7)";
  g.lineWidth = Math.max(1, r * 0.18);
  g.beginPath(); g.arc(x - r * 0.2, y - r * 0.1, r * 0.6, 0.3, 2.4); g.stroke();
  g.beginPath(); g.arc(x + r * 0.25, y + r * 0.2, r * 0.55, 3.4, 5.4); g.stroke();
}

/** 虫を描く（右向き・まん中が 0,0・R は 半径のピクセル）。 */
function drawBug(g: CanvasRenderingContext2D, kind: string, R: number, t: number): void {
  const leg = (n: number, len: number, col: string, phase = 0) => {
    g.strokeStyle = col; g.lineWidth = Math.max(1.5, R * 0.09); g.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const bx = (i / (n - 1) - 0.5) * R * 1.1, sw = Math.sin(t * 14 + i * 1.7 + phase) * R * 0.18;
      for (const sgn of [-1, 1]) {
        g.beginPath(); g.moveTo(bx, 0); g.quadraticCurveTo(bx + sw, sgn * len * 0.7, bx + sw * 1.6 + (i - (n - 1) / 2) * R * 0.15, sgn * len); g.stroke();
      }
    }
  };
  const eyes = (x: number, y: number, r: number) => {
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(x, y - r, r, 0, Math.PI * 2); g.arc(x, y + r * 0.6, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1a1a1a";
    g.beginPath(); g.arc(x + r * 0.35, y - r, r * 0.55, 0, Math.PI * 2); g.arc(x + r * 0.35, y + r * 0.6, r * 0.55, 0, Math.PI * 2); g.fill();
  };
  switch (kind) {
    case "ari": {
      leg(3, R * 0.9, "#2b211c");
      g.fillStyle = "#3a2c25";
      g.beginPath(); g.ellipse(-R * 0.6, 0, R * 0.5, R * 0.42, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(0, 0, R * 0.32, R * 0.28, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(R * 0.55, 0, R * 0.4, R * 0.38, 0, 0, Math.PI * 2); g.fill();
      eyes(R * 0.7, -R * 0.05, R * 0.12);
      break;
    }
    case "hae": {
      g.fillStyle = "rgba(220,240,255,.75)";
      const fl = Math.sin(t * 50) * 0.4;
      g.beginPath(); g.ellipse(-R * 0.1, -R * 0.55, R * 0.6, R * 0.28, -0.5 + fl, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(-R * 0.1, R * 0.55, R * 0.6, R * 0.28, 0.5 - fl, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4b5560";
      g.beginPath(); g.ellipse(-R * 0.2, 0, R * 0.65, R * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2c3238";
      g.beginPath(); g.arc(R * 0.5, 0, R * 0.38, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c0392b";
      g.beginPath(); g.arc(R * 0.65, -R * 0.22, R * 0.17, 0, Math.PI * 2); g.arc(R * 0.65, R * 0.22, R * 0.17, 0, Math.PI * 2); g.fill();
      break;
    }
    case "kumo": case "ookumo": {
      leg(4, R * 1.15, kind === "ookumo" ? "#3b2418" : "#4a3020", 1);
      g.fillStyle = kind === "ookumo" ? "#4a2a1a" : "#5c3a26";
      g.beginPath(); g.arc(-R * 0.35, 0, R * 0.62, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(R * 0.4, 0, R * 0.42, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,200,120,.35)";
      g.beginPath(); g.arc(-R * 0.45, -R * 0.15, R * 0.22, 0, Math.PI * 2); g.fill();
      eyes(R * 0.6, 0, R * 0.12);
      if (kind === "ookumo") { g.fillStyle = "#e74c3c"; g.beginPath(); g.arc(-R * 0.35, R * 0.1, R * 0.16, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case "dango": {
      leg(4, R * 0.75, "#3a3f45", 2);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = i % 2 ? "#6c7680" : "#5b646d";
        g.beginPath(); g.ellipse(-R * 0.6 + i * R * 0.3, 0, R * 0.32, R * 0.72, 0, 0, Math.PI * 2); g.fill();
      }
      eyes(R * 0.75, 0, R * 0.1);
      break;
    }
    case "gokiburi": {
      leg(3, R * 0.95, "#3a2416", 0.5);
      g.strokeStyle = "#3a2416"; g.lineWidth = Math.max(1, R * 0.05);
      g.beginPath(); g.moveTo(R * 0.6, -R * 0.1); g.quadraticCurveTo(R * 1.3, -R * 0.6, R * 1.6, -R * 0.3); g.stroke();
      g.beginPath(); g.moveTo(R * 0.6, R * 0.1); g.quadraticCurveTo(R * 1.3, R * 0.6, R * 1.6, R * 0.3); g.stroke();
      g.fillStyle = "#6b3a1c";
      g.beginPath(); g.ellipse(-R * 0.1, 0, R * 0.8, R * 0.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,220,180,.35)";
      g.beginPath(); g.ellipse(-R * 0.25, -R * 0.18, R * 0.45, R * 0.12, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(30,15,5,.6)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(R * 0.25, 0); g.lineTo(-R * 0.85, 0); g.stroke();
      g.fillStyle = "#4a2810";
      g.beginPath(); g.ellipse(R * 0.6, 0, R * 0.26, R * 0.3, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case "ka": {
      g.strokeStyle = "#3a3a40"; g.lineWidth = Math.max(1, R * 0.05);
      for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) {
        g.beginPath(); g.moveTo(-R * 0.2 + i * R * 0.25, 0); g.lineTo(-R * 0.6 + i * R * 0.5, sg * R * 1.2); g.stroke();
      }
      const fl = Math.sin(t * 60) * 0.5;
      g.fillStyle = "rgba(220,235,255,.7)";
      g.beginPath(); g.ellipse(-R * 0.2, -R * 0.55, R * 0.55, R * 0.2, -0.5 + fl, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(-R * 0.2, R * 0.55, R * 0.55, R * 0.2, 0.5 - fl, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#4a4a52";
      g.beginPath(); g.ellipse(-R * 0.55, 0, R * 0.6, R * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2c2c32";
      g.beginPath(); g.arc(R * 0.25, 0, R * 0.26, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#2c2c32"; g.lineWidth = Math.max(1, R * 0.07);
      g.beginPath(); g.moveTo(R * 0.45, 0); g.lineTo(R * 1.1, R * 0.05); g.stroke();
      g.fillStyle = "#c0392b";
      g.beginPath(); g.arc(R * 0.35, -R * 0.12, R * 0.09, 0, Math.PI * 2); g.fill();
      break;
    }
    case "kemushi": case "kemushiko": {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1), x = (-0.9 + k * 1.5) * R, yy = Math.sin(t * 8 - i * 0.9) * R * 0.1;
        g.fillStyle = "#e9c43a";
        for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2 + i; g.fillRect(x + Math.cos(a) * R * 0.38, yy + Math.sin(a) * R * 0.38, 1.5, 1.5); }
        g.fillStyle = i % 2 ? "#6aa83a" : "#7dbb46";
        g.beginPath(); g.arc(x, yy, R * 0.33, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#f2d24a";
        g.beginPath(); g.arc(x, yy - R * 0.1, R * 0.08, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = "#3d6b24";
      g.beginPath(); g.arc(R * 0.72, Math.sin(t * 8) * R * 0.1, R * 0.36, 0, Math.PI * 2); g.fill();
      eyes(R * 0.82, Math.sin(t * 8) * R * 0.1, R * 0.1);
      break;
    }
    case "kamakiri": {
      g.strokeStyle = "#3f8a2c"; g.lineWidth = Math.max(1.5, R * 0.08); g.lineCap = "round";
      for (const sg of [-1, 1]) for (let i = 0; i < 2; i++) {
        const sw = Math.sin(t * 10 + i + sg) * R * 0.1;
        g.beginPath(); g.moveTo(-R * 0.3 - i * R * 0.35, 0); g.lineTo(-R * 0.4 - i * R * 0.45 + sw, sg * R * 0.95); g.stroke();
      }
      g.fillStyle = "#6cbf4a";
      g.beginPath(); g.ellipse(-R * 0.55, 0, R * 0.65, R * 0.28, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#5aaa3c";
      g.beginPath(); g.ellipse(R * 0.25, 0, R * 0.4, R * 0.14, 0, 0, Math.PI * 2); g.fill();
      // かま
      const sw = Math.sin(t * 6) * 0.3;
      g.strokeStyle = "#4e9a34"; g.lineWidth = Math.max(2, R * 0.12);
      for (const sg of [-1, 1]) {
        g.beginPath(); g.moveTo(R * 0.4, sg * R * 0.1); g.lineTo(R * 0.9, sg * R * (0.45 + sw * 0.3)); g.lineTo(R * 0.7, sg * R * (0.15 + sw * 0.2)); g.stroke();
      }
      g.fillStyle = "#6cbf4a";
      g.beginPath(); g.moveTo(R * 0.6, -R * 0.25); g.lineTo(R * 1.0, 0); g.lineTo(R * 0.6, R * 0.25); g.closePath(); g.fill();
      g.fillStyle = "#e9e27a";
      g.beginPath(); g.arc(R * 0.65, -R * 0.18, R * 0.09, 0, Math.PI * 2); g.arc(R * 0.65, R * 0.18, R * 0.09, 0, Math.PI * 2); g.fill();
      break;
    }
    case "hachi": case "jooubachi": {
      const fl = Math.sin(t * 45) * 0.5;
      g.fillStyle = "rgba(230,245,255,.75)";
      g.beginPath(); g.ellipse(-R * 0.05, -R * 0.6, R * 0.55, R * 0.25, -0.6 + fl, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(-R * 0.05, R * 0.6, R * 0.55, R * 0.25, 0.6 - fl, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f2b630";
      g.beginPath(); g.ellipse(-R * 0.35, 0, R * 0.62, R * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#2a2118";
      for (let i = 0; i < 3; i++) g.fillRect(-R * 0.75 + i * R * 0.32, -R * 0.42, R * 0.12, R * 0.84);
      g.beginPath(); g.moveTo(-R * 0.95, -R * 0.08); g.lineTo(-R * 1.25, 0); g.lineTo(-R * 0.95, R * 0.08); g.fill();
      g.fillStyle = "#f2b630";
      g.beginPath(); g.arc(R * 0.45, 0, R * 0.36, 0, Math.PI * 2); g.fill();
      eyes(R * 0.6, 0, R * 0.12);
      if (kind === "jooubachi") {
        g.fillStyle = "#ffd84a";
        g.beginPath(); g.moveTo(R * 0.25, -R * 0.35); g.lineTo(R * 0.35, -R * 0.65); g.lineTo(R * 0.45, -R * 0.42); g.lineTo(R * 0.55, -R * 0.65); g.lineTo(R * 0.62, -R * 0.33); g.fill();
      }
      break;
    }
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
