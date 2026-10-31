// 戦闘の計算（画面とは別。テストで そのまま動かせる）。
// 止まると撃つ: スティックを離して止まっているあいだだけ、いちばん近い敵へ 毛玉を撃つ。
import { rollItem, rollRarity, type Item } from "../core/equip";
import type { Rng } from "../core/rng";
import type { Loadout } from "../core/save";
import { rollSkills, type SkillCounts, type SkillId } from "../core/skills";
import { ENEMIES, stageInfo, STAGES_PER_CHAPTER, type EnemyDef, type EnemyKind } from "../core/stages";

/** 部屋の広さ（単位: マス） */
export const W = 9;
export const H = 15;
export const DOOR_W = 1.8;

const SHOT_SPEED = 10;
const ESHOT_SPEED = 3.6;
const BASE_INTERVAL = 0.7;

export interface Input { mx: number; my: number }

export interface Hero {
  x: number; y: number; r: number;
  hp: number; maxHp: number;
  inv: number;        // 無敵の残り（秒）
  facing: 1 | -1;
  moving: boolean;
  dist: number;       // 歩いた距離（歩きのコマ送り）
  atkCd: number;
  shootAnim: number;
  hurtAnim: number;
  level: number;
  xp: number;
}

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number; y: number;
  vx: number; vy: number;
  hp: number; maxHp: number;
  dmg: number; shot: number;
  t: number; t2: number;      // 行動のタイマー
  mode: number;               // 行動の段階（突進の ため・突進 など）
  dx: number; dy: number;     // 突進の向き
  slow: number;
  burn: number; burnDps: number;
  poison: number;
  dotAcc: number; dotT: number;
  flash: number;
  facing: 1 | -1;
  dead: boolean;
}

export interface Shot {
  x: number; y: number; vx: number; vy: number;
  dmg: number; crit: boolean;
  pierce: boolean; bounce: number; ric: number;
  hit: Set<number>;
  life: number;
}

export interface EShot { x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number }

export type FxKind = "dmg" | "crit" | "dot" | "heal" | "dodge" | "die" | "hurt";
export interface Fx { kind: FxKind; x: number; y: number; v: number; t: number }

export type SoundKind = "shoot" | "hit" | "kill" | "hurt" | "levelup" | "clear" | "door" | "boss";

export type WorldState = "fight" | "clear" | "dead" | "won";

export class World {
  readonly hero: Hero;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  eshots: EShot[] = [];
  fx: Fx[] = [];
  sounds: SoundKind[] = [];
  skills: SkillCounts = {};
  state: WorldState = "fight";
  stage = 0;
  time = 0;
  /** 選んでいないレベルアップの数・いま出している選択肢 */
  pendingLevels = 0;
  choices: SkillId[] | null = null;
  coins = 0;
  drops: Item[] = [];
  kills = 0;
  private nextId = 1;
  private volleys: { t: number }[] = [];
  private orbCd = new Map<number, number>();

  constructor(readonly lo: Loadout, readonly chapter: number, readonly rng: Rng) {
    this.hero = {
      x: W / 2, y: H - 1.5, r: 0.36, hp: lo.hp, maxHp: lo.hp, inv: 0, facing: 1, moving: false, dist: 0,
      atkCd: 0.3, shootAnim: 0, hurtAnim: 0, level: 1, xp: 0,
    };
    this.startStage(1);
  }

  // ---------- 力（装備＋スキル） ----------
  private n(id: SkillId): number { return this.skills[id] ?? 0; }
  get atk(): number { return this.lo.atk * (1 + 0.25 * this.n("atk")); }
  get interval(): number { return Math.max(0.16, BASE_INTERVAL / ((1 + this.lo.stats.aspd) * (1 + 0.2 * this.n("aspd")))); }
  get critRate(): number { return Math.min(0.8, 0.05 + this.lo.stats.crit + 0.1 * this.n("crit")); }
  get critMul(): number { return 2 + 0.4 * this.n("crit"); }
  get dodge(): number { return Math.min(0.6, this.lo.stats.dodge + 0.08 * this.n("dodge")); }
  get guard(): number { return Math.min(0.6, this.lo.stats.guard); }
  get pierce(): boolean { return this.lo.pierce || this.n("pierce") > 0; }
  get bounce(): number { return this.lo.bounce + 2 * this.n("bounce"); }
  get orbs(): number { return 2 * this.n("orbit"); }
  xpNeed(level = this.hero.level): number { return 6 + 4 * (level - 1); }

  // ---------- ステージ ----------
  startStage(n: number): void {
    this.stage = n;
    this.state = "fight";
    this.shots = []; this.eshots = []; this.volleys = [];
    const h = this.hero;
    h.x = W / 2; h.y = H - 1.5; h.inv = 1; h.atkCd = 0.4;
    const info = stageInfo(this.chapter, n);
    this.enemies = info.enemies.map((k) => this.spawn(k, info.hpMul, info.dmgMul));
    if (info.boss) this.sounds.push("boss");
  }

  private spawn(kind: EnemyKind, hpMul: number, dmgMul: number): Enemy {
    const def = ENEMIES[kind];
    let x = W / 2, y = 3;
    if (!def.boss) {
      for (let i = 0; i < 20; i++) {
        x = 1 + this.rng() * (W - 2);
        y = 1.2 + this.rng() * (H * 0.55);
        if (Math.hypot(x - this.hero.x, y - this.hero.y) > 4.5 && this.enemies.every((e) => Math.hypot(e.x - x, e.y - y) > 1)) break;
      }
    }
    const hp = Math.round(def.hp * hpMul);
    return {
      id: this.nextId++, def, x, y, vx: 0, vy: 0, hp, maxHp: hp, dmg: def.dmg * dmgMul, shot: def.shot * dmgMul,
      t: 1 + this.rng() * 1.5, t2: 2 + this.rng(), mode: 0, dx: 0, dy: 0,
      slow: 0, burn: 0, burnDps: 0, poison: 0, dotAcc: 0, dotT: 0, flash: 0, facing: -1, dead: false,
    };
  }

  /** レベルアップの選択（UI から）。 */
  chooseSkill(id: SkillId): void {
    if (!this.choices?.includes(id)) return;
    this.skills[id] = this.n(id) + 1;
    const h = this.hero;
    if (id === "hpup") { const add = Math.round(h.maxHp * 0.2); h.maxHp += add; h.hp += add; }
    if (id === "heal") h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.4);
    this.pendingLevels--;
    this.choices = null;
    this.offerLevel();
  }

  private offerLevel(): void {
    if (this.pendingLevels > 0 && !this.choices) {
      this.choices = rollSkills(this.skills, this.rng, 3, this.hero.hp < this.hero.maxHp * 0.8);
      if (this.choices.length === 0) { this.pendingLevels = 0; this.choices = null; }
    }
  }

  /** 止まっている（選択中・おしまい）なら true */
  get paused(): boolean { return !!this.choices || this.state === "dead" || this.state === "won"; }

  // ---------- 1コマ ----------
  step(dt: number, input: Input): void {
    this.sounds.length = 0;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 0.9);
    if (this.paused) return;
    this.time += dt;
    this.moveHero(dt, input);
    if (this.state === "fight") this.attack(dt);
    this.moveShots(dt);
    this.moveEnemies(dt);
    this.moveEShots(dt);
    this.orbit(dt);
    if (this.state === "fight" && this.enemies.every((e) => e.dead)) this.clearStage();
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private moveHero(dt: number, input: Input): void {
    const h = this.hero;
    h.inv = Math.max(0, h.inv - dt);
    h.shootAnim = Math.max(0, h.shootAnim - dt);
    h.hurtAnim = Math.max(0, h.hurtAnim - dt);
    const m = Math.hypot(input.mx, input.my);
    h.moving = m > 0.15;
    if (h.moving) {
      const sp = 3.4 * Math.min(1, m);
      const nx = h.x + (input.mx / m) * sp * dt, ny = h.y + (input.my / m) * sp * dt;
      h.dist += sp * dt;
      if (Math.abs(input.mx) > 0.1) h.facing = input.mx > 0 ? 1 : -1;
      const doorOpen = this.state === "clear";
      const inDoor = doorOpen && Math.abs(nx - W / 2) < DOOR_W / 2 - h.r * 0.5;
      h.x = clamp(nx, h.r, W - h.r);
      h.y = clamp(ny, inDoor ? -1 : h.r, H - h.r);
      if (doorOpen && h.y < 0.1) this.enterDoor();
    }
  }

  private enterDoor(): void {
    this.sounds.push("door");
    this.startStage(this.stage + 1);
  }

  private clearStage(): void {
    const info = stageInfo(this.chapter, this.stage);
    this.coins += 5 * this.stage * this.coinMul;
    if (info.boss || this.rng() < 0.15) this.drops.push(rollItem(this.rng, 0, rollRarity(this.rng, this.chapter, info.boss)));
    if (this.lo.regen > 0) this.heal(this.hero.maxHp * this.lo.regen);
    this.eshots = [];
    this.sounds.push("clear");
    this.state = this.stage >= STAGES_PER_CHAPTER ? "won" : "clear";
  }

  private get coinMul(): number { return (1 + this.lo.stats.coinPct) * (1 + 0.3 * (this.chapter - 1)); }

  private heal(v: number): void {
    const h = this.hero;
    const add = Math.min(h.maxHp - h.hp, v);
    if (add <= 0) return;
    h.hp += add;
    this.fx.push({ kind: "heal", x: h.x, y: h.y - 1, v: Math.round(add), t: 0 });
  }

  private nearest(x: number, y: number, skip?: Set<number>, maxD = Infinity): Enemy | null {
    let best: Enemy | null = null, bd = maxD;
    for (const e of this.enemies) {
      if (e.dead || skip?.has(e.id)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private attack(dt: number): void {
    const h = this.hero;
    h.atkCd -= dt;
    // れんしゃ（あとから撃つ分）
    for (const v of this.volleys) v.t -= dt;
    while (this.volleys.length && this.volleys[0].t <= 0) { this.volleys.shift(); this.fire(); }
    if (h.moving || h.atkCd > 0) return;
    if (!this.nearest(h.x, h.y)) return;
    h.atkCd = this.interval;
    this.fire();
    for (let i = 1; i <= this.n("multi"); i++) this.volleys.push({ t: 0.12 * i });
  }

  private fire(): void {
    const h = this.hero;
    const target = this.nearest(h.x, h.y);
    if (!target) return;
    const a = Math.atan2(target.y - h.y, target.x - h.x);
    h.facing = Math.cos(a) >= 0 ? 1 : -1;
    h.shootAnim = 0.2;
    const dmg = this.atk * (1 - 0.1 * this.n("multi")) * (1 - 0.15 * this.n("front")) * (this.pierce ? 0.75 : 1);
    const nFront = 1 + this.n("front");
    for (let i = 0; i < nFront; i++) {
      const off = (i - (nFront - 1) / 2) * 0.28;
      this.addShot(h.x - Math.sin(a) * off, h.y + Math.cos(a) * off, a, dmg);
    }
    const angles: number[] = [];
    const d = this.n("diag"), s = this.n("side"), b = this.n("back");
    if (d >= 1) angles.push(a + Math.PI / 4, a - Math.PI / 4);
    if (d >= 2) angles.push(a + Math.PI / 8, a - Math.PI / 8);
    if (s >= 1) angles.push(a + Math.PI / 2, a - Math.PI / 2);
    if (s >= 2) angles.push(a + Math.PI * 0.62, a - Math.PI * 0.62);
    if (b >= 1) angles.push(a + Math.PI);
    if (b >= 2) angles.push(a + Math.PI * 0.9, a - Math.PI * 0.9);
    for (const an of angles) this.addShot(h.x, h.y, an, dmg);
    this.sounds.push("shoot");
  }

  private addShot(x: number, y: number, a: number, dmg: number): void {
    const crit = this.rng() < this.critRate;
    this.shots.push({
      x, y: y - 0.35, vx: Math.cos(a) * SHOT_SPEED, vy: Math.sin(a) * SHOT_SPEED,
      dmg: crit ? dmg * this.critMul : dmg, crit,
      pierce: this.pierce, bounce: this.bounce, ric: this.n("ricochet") ? 2 : 0, hit: new Set(), life: 3,
    });
  }

  private moveShots(dt: number): void {
    for (const s of this.shots) {
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      // 壁
      if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) {
        if (s.bounce > 0) {
          s.bounce--;
          if (s.x < 0 || s.x > W) { s.vx = -s.vx; s.x = clamp(s.x, 0, W); }
          if (s.y < 0 || s.y > H) { s.vy = -s.vy; s.y = clamp(s.y, 0, H); }
          s.hit.clear();
        } else s.life = 0;
      }
      if (s.life <= 0) continue;
      for (const e of this.enemies) {
        if (e.dead || s.hit.has(e.id)) continue;
        if (Math.hypot(e.x - s.x, e.y - 0.3 - s.y) > e.def.r + 0.16) continue;
        s.hit.add(e.id);
        this.hitEnemy(e, s.dmg, s.crit, true);
        if (s.ric > 0) {
          const nx = this.nearest(e.x, e.y, s.hit, 4.5);
          if (nx) {
            s.ric--;
            const a = Math.atan2(nx.y - e.y, nx.x - e.x);
            s.x = e.x; s.y = e.y - 0.3; s.vx = Math.cos(a) * SHOT_SPEED; s.vy = Math.sin(a) * SHOT_SPEED;
            break;
          }
        }
        if (!s.pierce) { s.life = 0; break; }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  private hitEnemy(e: Enemy, dmg: number, crit: boolean, direct: boolean): void {
    this.damage(e, dmg, crit ? "crit" : "dmg");
    if (!direct || e.dead) return;
    const atk = this.atk;
    if (this.n("fire")) { e.burn = 2; e.burnDps = Math.max(e.burnDps, atk * 0.18 * this.n("fire")); }
    if (this.n("ice")) e.slow = 1.5;
    if (this.n("poison")) e.poison = Math.max(e.poison, atk * 0.1 * this.n("poison"));
    if (this.n("bolt")) {
      const skip = new Set([e.id]);
      for (let i = 0; i < 2; i++) {
        const o = this.nearest(e.x, e.y, skip, 3.2);
        if (!o) break;
        skip.add(o.id);
        this.damage(o, atk * 0.35 * this.n("bolt"), "dmg");
      }
    }
  }

  private damage(e: Enemy, v: number, kind: FxKind): void {
    if (e.dead) return;
    e.hp -= v;
    e.flash = 0.12;
    if (kind !== "dot") this.fx.push({ kind, x: e.x + (this.rng() - 0.5) * 0.4, y: e.y - e.def.r * 2 - 0.4, v: Math.round(v), t: 0 });
    this.sounds.push("hit");
    if (e.hp <= 0) this.kill(e);
  }

  private kill(e: Enemy): void {
    e.dead = true;
    this.kills++;
    this.fx.push({ kind: "die", x: e.x, y: e.y, v: e.def.r, t: 0 });
    this.sounds.push("kill");
    this.coins += e.def.coins * this.coinMul;
    if (this.n("vamp")) this.heal(this.hero.maxHp * 0.02 * this.n("vamp"));
    const h = this.hero;
    h.xp += e.def.xp;
    while (h.xp >= this.xpNeed()) {
      h.xp -= this.xpNeed();
      h.level++;
      this.pendingLevels++;
      this.sounds.push("levelup");
    }
    this.offerLevel();
  }

  private hurt(dmg: number): void {
    const h = this.hero;
    if (h.inv > 0 || this.state === "dead") return;
    if (this.rng() < this.dodge) {
      h.inv = 0.3;
      this.fx.push({ kind: "dodge", x: h.x, y: h.y - 1.2, v: 0, t: 0 });
      return;
    }
    const v = Math.max(1, Math.round(dmg * (1 - this.guard)));
    h.hp -= v;
    h.inv = 0.6;
    h.hurtAnim = 0.3;
    this.fx.push({ kind: "hurt", x: h.x, y: h.y - 1.2, v, t: 0 });
    this.sounds.push("hurt");
    if (h.hp <= 0) { h.hp = 0; this.state = "dead"; }
  }

  private moveEnemies(dt: number): void {
    const h = this.hero;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt);
      // 燃える・毒（まとめて 0.5秒ごとに数字を出す）
      let dot = 0;
      if (e.burn > 0) { e.burn -= dt; dot += e.burnDps * dt; }
      dot += e.poison * dt;
      if (dot > 0) {
        e.dotAcc += dot; e.dotT += dt;
        this.damage(e, dot, "dot");
        if (e.dotT >= 0.5 && !e.dead) { this.fx.push({ kind: "dot", x: e.x, y: e.y - e.def.r * 2 - 0.4, v: Math.round(e.dotAcc), t: 0 }); e.dotAcc = 0; e.dotT = 0; }
      }
      if (e.dead) continue;
      this.think(e, dt * (e.slow > 0 ? 0.6 : 1));
      e.x = clamp(e.x, e.def.r, W - e.def.r);
      e.y = clamp(e.y, e.def.r, H - e.def.r);
      if (Math.abs(e.vx) > 0.05) e.facing = e.vx > 0 ? 1 : -1;
      if (Math.hypot(e.x - h.x, e.y - h.y) < e.def.r + h.r) this.hurt(e.dmg);
    }
  }

  /** 敵の動き（dt は 遅くなる分を ふくむ） */
  private think(e: Enemy, dt: number): void {
    const h = this.hero;
    const dx = h.x - e.x, dy = h.y - e.y, dist = Math.hypot(dx, dy) || 1;
    const sp = e.def.speed;
    const go = (vx: number, vy: number) => { e.vx = vx; e.vy = vy; e.x += vx * dt; e.y += vy * dt; };
    e.t -= dt; e.t2 -= dt;
    switch (e.def.ai) {
      case "chase":
        go((dx / dist) * sp, (dy / dist) * sp);
        break;
      case "wander": {
        if (e.t <= 0) {
          const a = Math.atan2(dy, dx) + (this.rng() - 0.5) * 2.4;
          e.dx = Math.cos(a); e.dy = Math.sin(a); e.t = 0.8 + this.rng();
        }
        if (e.x <= e.def.r + 0.01 || e.x >= W - e.def.r - 0.01) e.dx = -e.dx;
        if (e.y <= e.def.r + 0.01 || e.y >= H - e.def.r - 0.01) e.dy = -e.dy;
        go(e.dx * sp, e.dy * sp);
        break;
      }
      case "turret":
        if (e.t2 <= 0) { const a = this.rng() * Math.PI * 2; e.dx = Math.cos(a); e.dy = Math.sin(a); e.t2 = 1.5 + this.rng(); }
        go(e.dx * sp, e.dy * sp);
        if (e.t <= 0) { this.aim(e, 1, 0); e.t = 2.2 + this.rng() * 0.6; }
        break;
      case "charge":
        if (e.mode === 0) { // まつ
          go(0, 0);
          if (e.t <= 0) { e.mode = 1; e.t = 0.5; e.dx = dx / dist; e.dy = dy / dist; }
        } else if (e.mode === 1) { // ため（ぷるぷる）
          go(0, 0);
          if (e.t <= 0) { e.mode = 2; e.t = 0.55; }
        } else {
          go(e.dx * sp, e.dy * sp);
          if (e.t <= 0) { e.mode = 0; e.t = 1.2 + this.rng() * 0.6; }
        }
        break;
      case "kite": {
        const want = dist < 3 ? -1 : dist > 4.5 ? 1 : 0;
        const sx = -dy / dist, sy = dx / dist; // よこへ
        go((dx / dist) * sp * want + sx * sp * 0.6, (dy / dist) * sp * want + sy * sp * 0.6);
        if (e.t <= 0) { this.aim(e, 3, 0.26); e.t = 2.6 + this.rng() * 0.5; }
        break;
      }
      case "boss1":
        go((dx / dist) * sp, (dy / dist) * sp);
        if (e.t <= 0) { this.ring(e, 12); e.t = 3.2; }
        if (e.t2 <= 0) { this.aim(e, 3, 0.3); e.t2 = 1.6; }
        break;
      case "boss2":
        if (e.mode === 0) {
          if (e.t <= 0 || Math.hypot(e.dx - e.x, e.dy - e.y) < 0.3) {
            e.dx = 1.5 + this.rng() * (W - 3); e.dy = 1.5 + this.rng() * (H * 0.5); e.t = 2;
          }
          const mx = e.dx - e.x, my = e.dy - e.y, md = Math.hypot(mx, my) || 1;
          go((mx / md) * sp, (my / md) * sp);
          if (e.t2 <= 0) {
            if (this.rng() < 0.3) { e.mode = 1; e.t = 0.6; e.dx = dx / dist; e.dy = dy / dist; }
            else if (this.rng() < 0.5) this.ring(e, 16);
            else this.aim(e, 5, 0.22);
            e.t2 = 1.4;
          }
        } else if (e.mode === 1) { // 突進のため
          go(0, 0);
          if (e.t <= 0) { e.mode = 2; e.t = 0.7; }
        } else {
          go(e.dx * 6, e.dy * 6);
          if (e.t <= 0) { e.mode = 0; e.t = 0; e.dx = e.x; e.dy = e.y; }
        }
        break;
    }
  }

  /** 猫をねらって n 発（spread ラジアンずつ広げる） */
  private aim(e: Enemy, n: number, spread: number): void {
    const a = Math.atan2(this.hero.y - e.y, this.hero.x - e.x);
    for (let i = 0; i < n; i++) this.eshot(e, a + (i - (n - 1) / 2) * spread);
  }

  private ring(e: Enemy, n: number): void {
    const o = this.rng() * Math.PI;
    for (let i = 0; i < n; i++) this.eshot(e, o + (i / n) * Math.PI * 2);
  }

  private eshot(e: Enemy, a: number): void {
    this.eshots.push({ x: e.x, y: e.y - 0.2, vx: Math.cos(a) * ESHOT_SPEED, vy: Math.sin(a) * ESHOT_SPEED, r: 0.17, dmg: e.shot, life: 6 });
  }

  private moveEShots(dt: number): void {
    const h = this.hero;
    for (const s of this.eshots) {
      s.life -= dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) s.life = 0;
      else if (Math.hypot(s.x - h.x, s.y - (h.y - 0.3)) < s.r + h.r * 0.8) { this.hurt(s.dmg); s.life = 0; }
    }
    this.eshots = this.eshots.filter((s) => s.life > 0);
  }

  /** まわる毛糸玉の位置 */
  orbPositions(): [number, number][] {
    const n = this.orbs, h = this.hero;
    return Array.from({ length: n }, (_, i) => {
      const a = this.time * 3.2 + (i / n) * Math.PI * 2;
      return [h.x + Math.cos(a) * 1.05, h.y - 0.35 + Math.sin(a) * 1.05] as [number, number];
    });
  }

  private orbit(dt: number): void {
    if (!this.orbs) return;
    for (const [k, v] of this.orbCd) this.orbCd.set(k, v - dt);
    for (const [ox, oy] of this.orbPositions()) {
      for (const e of this.enemies) {
        if (e.dead || (this.orbCd.get(e.id) ?? 0) > 0) continue;
        if (Math.hypot(e.x - ox, e.y - 0.3 - oy) < e.def.r + 0.25) {
          this.orbCd.set(e.id, 0.45);
          this.damage(e, this.atk * 0.5, "dmg");
        }
      }
    }
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
