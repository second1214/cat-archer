// 戦闘の絵（canvas）。猫は PNG、虫は コードで描く。
import { DOOR_W, H, W, type Enemy, type World } from "./world";

const CAT_FRAMES = ["walk1", "walk2", "walk3", "walk4", "shoot", "hurt", "jump", "sit"] as const;
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
    items.push({ y: w.hero.y, f: () => this.drawHero(w) });
    items.sort((a, b) => a.y - b.y).forEach((it) => it.f());
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
    const key = `${s}:${this.ox}:${this.oy}`;
    if (!floorCache || floorCache.key !== key) floorCache = { key, cv: this.makeFloor() };
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

  private makeFloor(): HTMLCanvasElement {
    const dpr = this.cv.width / this.cv.getBoundingClientRect().width;
    const cv = document.createElement("canvas");
    cv.width = this.cv.width; cv.height = this.cv.height;
    const g = cv.getContext("2d")!;
    g.scale(dpr, dpr);
    const s = this.s, x0 = this.X(0), y0 = this.Y(0);
    // 壁
    g.fillStyle = "#c9a27a";
    g.fillRect(x0 - WALL * s, y0 - WALL * s, (W + WALL * 2) * s, (H + WALL * 2) * s);
    g.fillStyle = "#a57b55";
    g.fillRect(x0 - WALL * s, y0 - WALL * s, (W + WALL * 2) * s, WALL * s);
    // 床（板）
    const plank = 0.75;
    for (let i = 0; i * plank < H; i++) {
      g.fillStyle = i % 2 ? "#e2bf8f" : "#ddb685";
      g.fillRect(x0, y0 + i * plank * s, W * s, plank * s);
      g.fillStyle = "rgba(120,80,40,.18)";
      g.fillRect(x0, y0 + i * plank * s, W * s, 1.2);
      const off = (i * 2.3) % 3;
      for (let k = off; k < W; k += 3) g.fillRect(x0 + k * s, y0 + i * plank * s, 1.2, plank * s);
    }
    // ふちの影
    const gr = g.createLinearGradient(0, y0, 0, y0 + s * 0.8);
    gr.addColorStop(0, "rgba(60,30,10,.25)"); gr.addColorStop(1, "rgba(60,30,10,0)");
    g.fillStyle = gr; g.fillRect(x0, y0, W * s, s * 0.8);
    return cv;
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
      : h.moving ? (`walk${(Math.floor(h.dist * 2.6) % 4) + 1}` as CatFrame)
      : h.shootAnim > 0 ? "shoot" : "walk1";
    const im = imgs.get(frame) ?? imgs.get("walk1");
    if (h.inv > 0 && h.hurtAnim <= 0 && Math.floor(w.time * 16) % 2 === 0 && w.state === "fight") g.globalAlpha = 0.55;
    if (im) {
      const dw = (im.width / CAT_PX) * s, dh = (im.height / CAT_PX) * s;
      g.save();
      g.translate(this.X(h.x), this.Y(h.y) + s * 0.08);
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
    if ((e.def.ai === "charge" || e.def.ai === "boss2") && e.mode === 1) g.translate(Math.sin(t * 60) * s * 0.04, 0);
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
