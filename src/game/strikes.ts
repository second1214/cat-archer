// ストライク（近所の猫が 助けに飛びこむ）。プレイヤーの攻撃とは べつに、移動中も 自動で動く。
// 呼ぶ手段: スキル（助っ人ねこ・いっしょにアタック・おいうち・しかえし・ねこ集会・レーザー好きのねこ）、
// ルーン（時計ねこ・またたびの小袋）。ダメージは 攻撃力×係数 ＋ 助っ人ねこ専用の増加（武器専用の増加は のらない）。
import { CATS } from "../core/cats";
import type { RuneEffects } from "../core/runes";
import type { SkillId } from "../core/skills";
import type { Terrain } from "../core/terrain";

/** 呼ばれる距離（これより遠い敵には 来ない） */
export const STRIKE_RANGE = 6;
const SPEED = 9;
const MINI_SPEED = 10;
const COEF = 0.75;
const DRAGON_COEF = 1;
const BEAM_COEF = 0.5;
const DRAGON_BEAM_COEF = 0.55;
const BEAM_HITS = 4;
const RICOCHET_MAX = 3;
const POTION_CATS = 5;
const HOMING_TURN = 4.5;
/** ボス猫が 現れてから 走りだすまで */
export const DRAGON_WINDUP = 0.3;

export interface StrikeEnemy { id: number; x: number; y: number; hp: number; maxHp: number; dead: boolean; def: { r: number } }

/** 戦闘（World）から 借りるもの */
export interface StrikeHost {
  readonly enemies: StrikeEnemy[];
  readonly hero: { x: number; y: number; r: number };
  readonly terrain: Terrain;
  readonly rng: () => number;
  readonly rune: RuneEffects;
  readonly heroCat: string;
  n(id: SkillId): number;
  /** 攻撃力（ATK PWR）。武器専用の増加は ふくまない */
  readonly atkPower: number;
  readonly critRate: number;
  readonly critMul: number;
  /** 攻撃の速さの倍率（1 が ふつう） */
  readonly speedMul: number;
  /** 装備の 助っ人ねこのダメージ +% */
  readonly strikePct: number;
  /** プレイヤーの ゆうどう */
  readonly homing: boolean;
  nearest(x: number, y: number, skip?: Set<number>, maxD?: number): StrikeEnemy | null;
  /** 当てる（elements: 炎・氷・毒・雷を のせる） */
  hitEnemy(e: StrikeEnemy, dmg: number, crit: boolean, elements: boolean): void;
  addBeam(pts: [number, number][], crit: boolean): void;
}

export type StrikeKind = "normal" | "dragon" | "mini";

export interface Strike {
  x: number; y: number; vx: number; vy: number;
  kind: StrikeKind;
  /** 1回の ダメージ（会心の前） */
  dmg: number;
  target: number;
  life: number;
  hit: Set<number>;
  ric: number;
  homing: boolean;
  /** レーザーを撃つ猫: のこりの回数・つぎまで */
  beams: number;
  beamT: number;
  cat: string;
  /** 現れてから 動きだすまで（ボス猫の 構え） */
  delay: number;
}

export interface Pickup { x: number; y: number; t: number }

export class Strikes {
  list: Strike[] = [];
  pickups: Pickup[] = [];
  private tInstant = 0;
  private tBeam = 0;
  private tTime = 0;
  private tPotion = 6;
  private catIds: string[];

  constructor(private readonly w: StrikeHost) {
    this.catIds = CATS.map((c) => c.id).filter((id) => id !== w.heroCat && id !== "taisho" && id !== "komugi");
  }

  private get beamMode(): boolean { return this.w.n("s_beam") > 0; }
  /** スキルで呼ぶ数の倍率（ふたごの助っ人） */
  private get twin(): number { return this.w.n("s_twin") > 0 ? 2 : 1; }
  /** 「またたび」を持っているか（ルーンで はじめから） */
  get hasPotion(): boolean { return this.w.rune.potion.start; }

  /** 助っ人ねこの ダメージの倍率（専用の増加） */
  private get mul(): number { return (1 + 0.5 * this.w.n("s_boost")) * (1 + this.w.strikePct); }
  private baseDmg(dragon: boolean): number {
    const coef = this.beamMode ? (dragon ? DRAGON_BEAM_COEF : BEAM_COEF) : dragon ? DRAGON_COEF : COEF;
    return (this.w.atkPower * coef + this.w.rune.strikeDmg) * this.mul;
  }

  // ---------- 呼ぶ ----------

  /** n匹 呼ぶ（近くに敵が いなければ 来ない）。来たら true */
  summon(count: number, beamCat = false): boolean {
    const h = this.w.hero;
    const tg = this.w.nearest(h.x, h.y, undefined, STRIKE_RANGE);
    if (!tg) return false;
    for (let i = 0; i < count; i++) {
      const dragon = this.w.rng() < this.w.rune.dragonChance;
      const beam = beamCat || this.beamMode;
      // ふつうは 攻撃だけが 猫の位置から飛ぶ。ボス猫は 猫のまわりに現れて、少し構えてから 走っていく
      let x = h.x, y = h.y - 0.4;
      if (dragon) {
        const a = this.w.rng() * Math.PI * 2;
        x = Math.max(0.3, Math.min(8.7, h.x + Math.cos(a) * 1.1)); y = Math.max(0.3, Math.min(14.7, h.y - 0.4 + Math.sin(a) * 0.7));
        if (this.w.terrain.blocksShot(x, y + 0.3)) { x = h.x; y = h.y - 0.4; }
      }
      this.launch(x, y, tg, dragon ? "dragon" : "normal", this.baseDmg(dragon), beam);
      if (dragon) this.list[this.list.length - 1].delay = DRAGON_WINDUP;
    }
    return true;
  }

  private launch(x: number, y: number, tg: StrikeEnemy, kind: StrikeKind, dmg: number, beam: boolean, homing = false): void {
    const d = Math.hypot(tg.x - x, tg.y - 0.3 - y) || 1;
    const sp = kind === "mini" ? MINI_SPEED : SPEED;
    this.list.push({
      x, y, vx: ((tg.x - x) / d) * sp, vy: ((tg.y - 0.3 - y) / d) * sp, kind, dmg, target: tg.id, life: kind === "mini" ? 1.2 : 1.6,
      hit: new Set(), ric: 0, homing, beams: beam && kind !== "mini" ? BEAM_HITS : 0, beamT: 0, delay: 0,
      cat: kind === "dragon" ? "taisho" : kind === "mini" ? "komugi" : this.catIds[Math.floor(this.w.rng() * this.catIds.length)],
    });
  }

  // ---------- きっかけ（World から呼ぶ） ----------

  onStageStart(): void {
    this.list = []; this.pickups = [];
    if (this.w.n("s_blitz")) this.summon(5 * this.twin);
  }
  onStageClear(): void { this.list = []; this.pickups = []; }
  onFire(): void { if (this.w.n("s_assault") && this.w.rng() < 0.25) this.summon(1 * this.twin); }
  onKill(): void { if (this.w.n("s_pursuit")) this.summon(1 * this.twin); }
  onHurt(): void { if (this.w.n("s_riposte")) this.summon(5 * this.twin); }

  // ---------- 1コマ ----------

  update(dt: number, fighting: boolean): void {
    if (fighting) this.timers(dt);
    this.move(dt);
  }

  private timers(dt: number): void {
    const spd = this.w.speedMul;
    // 時間で呼ぶものは、敵が遠くて来られなかったら 次のコマで また試す
    if (this.w.n("s_instant")) {
      this.tInstant -= dt;
      if (this.tInstant <= 0 && this.summon(1 * this.twin)) this.tInstant = 1 / spd;
    }
    if (this.w.n("s_beam")) {
      this.tBeam -= dt;
      if (this.tBeam <= 0 && this.summon(1 * this.twin, true)) this.tBeam = 2.5 / spd;
    }
    const ts = this.w.rune.timeSword;
    if (ts) {
      this.tTime -= dt;
      if (this.tTime <= 0 && this.summon(this.w.rng() < ts.doubleChance ? 2 : 1)) this.tTime = ts.interval / spd;
    }
    // またたび: 床に1つだけ。なくなったら しばらくして また出る
    if (this.hasPotion) {
      if (!this.pickups.length) {
        this.tPotion -= dt;
        if (this.tPotion <= 0) this.dropPotion();
      }
      const h = this.w.hero;
      for (const p of this.pickups) {
        p.t += dt;
        if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + 0.4) this.takePotion(p);
      }
    }
  }

  private dropPotion(): void {
    const t = this.w.terrain;
    for (let i = 0; i < 30; i++) {
      const x = 1 + this.w.rng() * 7, y = 2 + this.w.rng() * 10;
      if (!t.hits(x, y, 0.35) && Math.hypot(x - this.w.hero.x, y - this.w.hero.y) > 2) { this.pickups.push({ x, y, t: 0 }); return; }
    }
  }

  private takePotion(p: Pickup): void {
    this.pickups = this.pickups.filter((q) => q !== p);
    this.tPotion = 8 + this.w.rng() * 4;
    let n = POTION_CATS * this.twin + this.w.rune.potion.extraOnPickup;
    if (this.w.rng() < this.w.rune.potion.doubleChance) n *= 2;
    this.summon(n);
  }

  private move(dt: number): void {
    const out: Strike[] = [];
    for (const s of this.list) {
      s.life -= dt;
      let tg = this.w.enemies.find((e) => e.id === s.target && !e.dead) ?? null;
      // 追いかける子ねこは ねらいが いなくなったら 次の敵へ
      if (!tg && s.homing) { tg = this.w.nearest(s.x, s.y + 0.3, s.hit, STRIKE_RANGE); if (tg) s.target = tg.id; }
      // レーザーを撃つ猫: 敵の近くで止まって 撃つ
      if (s.delay > 0) {
        s.delay -= dt; s.life += dt;
        // 構えているあいだは ねらう敵の方を向く
        if (tg) { const d = Math.hypot(tg.x - s.x, tg.y - 0.3 - s.y) || 1, sp = Math.hypot(s.vx, s.vy); s.vx = ((tg.x - s.x) / d) * sp; s.vy = ((tg.y - 0.3 - s.y) / d) * sp; }
        out.push(s);
        continue;
      }
      if (s.beams > 0) {
        const near = tg && Math.hypot(tg.x - s.x, tg.y - s.y) < 3;
        if (near || s.life < 1) {
          s.vx = 0; s.vy = 0;
          s.beamT -= dt;
          if (s.beamT <= 0) { this.shootBeam(s); s.beamT = 0.18; s.beams--; }
          if (s.beams <= 0) { s.life = 0; }
          if (s.life > 0) out.push(s);
          continue;
        }
      }
      if ((s.homing || this.w.homing) && tg) {
        const sp = Math.hypot(s.vx, s.vy), cur = Math.atan2(s.vy, s.vx);
        let d = Math.atan2(tg.y - 0.3 - s.y, tg.x - s.x) - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const na = cur + Math.max(-HOMING_TURN * dt, Math.min(HOMING_TURN * dt, d));
        s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      // 壁・物は 通れない
      if (s.x < 0 || s.x > 9 || s.y < 0 || s.y > 15 || this.w.terrain.blocksShot(s.x, s.y + 0.3)) s.life = 0;
      if (s.life > 0 && s.beams === 0) this.collide(s);
      if (s.life > 0) out.push(s);
      else this.fade(s);
    }
    this.list = out;
  }

  private dmgTo(s: Strike, e: StrikeEnemy): [number, boolean] {
    const crit = this.w.rng() < Math.min(0.9, this.w.critRate + this.w.rune.famCrit.strike);
    let v = s.dmg * (crit ? this.w.critMul : 1) * (1 + this.w.rune.strikePct);
    if (e.hp < e.maxHp * 0.5) v *= 1 + this.w.rune.lowHpBonus;
    return [v, crit];
  }

  private collide(s: Strike): void {
    for (const e of this.w.enemies) {
      if (e.dead || s.hit.has(e.id)) continue;
      if (Math.hypot(e.x - s.x, e.y - 0.3 - s.y) > e.def.r + (s.kind === "dragon" ? 0.35 : 0.2)) continue;
      s.hit.add(e.id);
      const [v, crit] = this.dmgTo(s, e);
      this.w.hitEnemy(e, v, crit, this.w.n("s_enchant") > 0);
      // ねこの集会所: 子ねこが加わる（子ねこからは 加わらない）
      if (s.kind !== "mini" && this.w.rng() < this.w.rune.aerieChance) {
        const o = this.w.nearest(e.x, e.y, s.hit, STRIKE_RANGE);
        if (o) this.launch(e.x, e.y - 0.3, o, "mini", s.dmg / 2, false);
      }
      // ねこリレー: 次の敵へ 跳ね返る
      if (s.ric < RICOCHET_MAX && this.w.rng() < this.w.rune.ricochetChance) {
        const o = this.w.nearest(e.x, e.y, s.hit, 4.5);
        if (o) {
          s.ric++;
          const d = Math.hypot(o.x - e.x, o.y - e.y) || 1, sp = Math.hypot(s.vx, s.vy);
          s.x = e.x; s.y = e.y - 0.3; s.vx = ((o.x - e.x) / d) * sp; s.vy = ((o.y - e.y) / d) * sp;
          s.target = o.id; s.life = Math.max(s.life, 0.8);
          return;
        }
      }
      s.life = 0;
      return;
    }
  }

  /** 帰るとき（子ねこ連れ: 子ねこに分かれる） */
  private fade(s: Strike): void {
    const sp = this.w.rune.split;
    if (!sp || s.kind === "mini" || this.w.rng() >= sp.chance) return;
    for (let i = 0; i < sp.count; i++) {
      const a = (i / sp.count) * Math.PI * 2;
      const tg = this.w.nearest(s.x, s.y + 0.3, undefined, STRIKE_RANGE);
      const fake = tg ?? { id: -1, x: s.x + Math.cos(a), y: s.y + 0.3 + Math.sin(a), hp: 1, maxHp: 1, dead: false, def: { r: 0 } };
      this.launch(s.x, s.y, fake, "mini", s.dmg * 0.33, false, sp.homing);
      const m = this.list[this.list.length - 1] ?? null;
      // 分かれた子ねこは ばらけて飛ぶ（追いかける子ねこは そのあと曲がる）
      if (m) { const v = Math.hypot(m.vx, m.vy); m.vx = Math.cos(a) * v; m.vy = Math.sin(a) * v; }
    }
  }

  /** レーザー: いちばん近い敵へ まっすぐ（物で止まる）。とちゅうの敵 ぜんぶに当たる */
  private shootBeam(s: Strike): void {
    const tg = this.w.nearest(s.x, s.y + 0.3, undefined, STRIKE_RANGE + 2);
    if (!tg) return;
    const a = Math.atan2(tg.y - 0.3 - s.y, tg.x - s.x), cx = Math.cos(a), cy = Math.sin(a);
    let len = 0;
    for (; len < 20; len += 0.1) {
      const px = s.x + cx * len, py = s.y + cy * len;
      if (px < 0 || px > 9 || py < 0 || py > 15 || this.w.terrain.blocksShot(px, py + 0.3)) break;
    }
    const hits: StrikeEnemy[] = [];
    for (const e of this.w.enemies) {
      if (e.dead) continue;
      const ex = e.x - s.x, ey = e.y - 0.3 - s.y, along = ex * cx + ey * cy;
      if (along >= 0 && along <= len + e.def.r && Math.abs(ex * cy - ey * cx) < e.def.r + 0.12) hits.push(e);
    }
    let anyCrit = false;
    for (const e of hits) { const [v, crit] = this.dmgTo(s, e); anyCrit ||= crit; this.w.hitEnemy(e, v, crit, this.w.n("s_enchant") > 0); }
    this.w.addBeam([[s.x, s.y], [s.x + cx * len, s.y + cy * len]], anyCrit);
  }
}
