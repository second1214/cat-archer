// 戦闘の画面: canvas・スティック・HUD・レベルアップの3択・一時停止・結果。
import { ITEM_MAP, RARITY_NAMES, type Item } from "../core/equip";
import type { Rune } from "../core/runes";
import { mulberry32 } from "../core/rng";
import { loadoutOf, type SaveData } from "../core/save";
import { SKILL_MAP, TIER_NAMES } from "../core/skills";
import { REVIVE_COST } from "../core/run";
import { DESCENT_NAMES } from "../core/godforge";
import { writeSave } from "../core/save";
import { CHAPTER_NAMES, STAGES_PER_CHAPTER } from "../core/stages";
import { loadCatImages, Renderer, type Stick } from "../game/render";
import { World } from "../game/world";
import { fmt, h, overlay } from "./dom";
import { runeCard } from "./runes";
import { bgm, sfx } from "./sfx";

export interface BattleEnd { stage: number; won: boolean; coins: number; drops: Item[]; runeDrops: Rune[]; churu: number; kills: number; killsBy: World["killsBy"] }

/** 毎日の挑戦などで 使う（面の数・見出し。拾った物は 出さない） */
export interface BattleMode { stages: number; title: string; tower?: number }

export function startBattle(save: SaveData, chapter: number, onEnd: (r: BattleEnd) => void, mode?: BattleMode, hard = false): void {
  void loadCatImages(save.cat);
  const lastSt = mode?.stages ?? STAGES_PER_CHAPTER;
  const world = new World(loadoutOf(save), chapter, mulberry32((save.seed = (save.seed * 16807 + 11) % 2147483647)), save.cat, mode?.tower ? mode.tower + lastSt - 1 : lastSt, mode?.tower ?? 0, hard);
  const cv = h("canvas", { class: "bt-cv" });
  const stageEl = h("div", { class: "bt-stage" });
  const hpFill = h("div", { class: "bar-fill hp" });
  const hpText = h("span", { class: "bar-t" });
  const xpFill = h("div", { class: "bar-fill xp" });
  const lvEl = h("span", { class: "bt-lv" });
  const bossBar = h("div", { class: "bt-boss" }, h("div", { class: "bt-boss-n" }), h("div", { class: "bar" }, h("div", { class: "bar-fill boss" })));
  const descEl = h("div", { class: "bt-desc" });
  const pauseBtn = h("button", { class: "bt-pause", "aria-label": "一時停止" }, h("i"), h("i"));
  const root = h("div", { class: "battle" }, cv,
    h("div", { class: "bt-hud" },
      h("div", { class: "bt-top" }, stageEl, pauseBtn),
      h("div", { class: "bar bt-hp" }, hpFill, hpText),
      h("div", { class: "bt-xprow" }, lvEl, h("div", { class: "bar bt-xp" }, xpFill)),
      descEl,
      bossBar));
  // はじめての人へ: 操作の 案内（動いたら 消える）
  const hint = !mode && chapter === 1 && !save.best[1] ? h("div", { class: "bt-hint" }, "👆 指を すべらせて 動く", h("br"), "止まると 自動で 撃つ！") : null;
  if (hint) root.append(hint);
  document.getElementById("app")!.append(root);

  const music = mode ? "tower" : "field";
  bgm(music);
  const ren = new Renderer(cv);
  const onResize = () => ren.resize();
  window.addEventListener("resize", onResize);
  ren.resize();

  // ---- スティック（画面のどこでも。指を置いた所が まん中） ----
  const stick: Stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
  let pid = -1;
  const keys = new Set<string>();
  const pt = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  cv.addEventListener("pointerdown", (e) => {
    if (pid !== -1) return;
    pid = e.pointerId; cv.setPointerCapture(pid);
    const [x, y] = pt(e);
    Object.assign(stick, { active: true, ox: x, oy: y, x, y });
  });
  cv.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid) return;
    const [x, y] = pt(e);
    const dx = x - stick.ox, dy = y - stick.oy, d = Math.hypot(dx, dy), m = 46;
    stick.x = stick.ox + (d > m ? (dx / d) * m : dx);
    stick.y = stick.oy + (d > m ? (dy / d) * m : dy);
  });
  const up = (e: PointerEvent) => { if (e.pointerId === pid) { pid = -1; stick.active = false; } };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  const kd = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
  const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  const input = () => {
    let mx = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
    let my = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
    if (stick.active) { mx = (stick.x - stick.ox) / 46; my = (stick.y - stick.oy) / 46; }
    return { mx, my };
  };

  // ---- 一時停止・レベルアップ・結果 ----
  let paused = false;
  let modal: { close(): void } | null = null;
  let ended = false;
  let endTimer = 0;

  pauseBtn.addEventListener("click", () => {
    if (modal || ended) return;
    paused = true;
    const owned = Object.entries(world.skills).filter(([, n]) => n);
    modal = overlay(h("div", { class: "pause" },
      h("h2", null, "一時停止"),
      h("div", { class: "pause-skills" }, owned.length
        ? owned.map(([id, n]) => h("span", { class: "chip" }, SKILL_MAP[id as keyof typeof SKILL_MAP].icon, " ", SKILL_MAP[id as keyof typeof SKILL_MAP].name, n! > 1 ? ` ×${n}` : ""))
        : h("span", { class: "muted" }, "まだスキルはありません")),
      h("button", { class: "btn btn-gold", onclick: () => { modal?.close(); modal = null; paused = false; } }, "つづける"),
      h("button", { class: "btn btn-ghost", onclick: () => { modal?.close(); modal = null; world.state = "dead"; world.hero.hp = 0; } }, "あきらめる")));
  });

  const showChoices = () => {
    const ch = world.choices!;
    sfx("levelup");
    modal = overlay(h("div", { class: "lvup" },
      h("div", { class: "lvup-t" }, `レベル ${world.hero.level - world.pendingLevels + 1}！`),
      h("div", { class: "lvup-sub" }, "スキルを1つえらんでね"),
      h("div", { class: "lvup-cards" }, ch.map((id) => {
        const d = SKILL_MAP[id], n = world.skills[id] ?? 0;
        return h("button", { class: `lvup-card tier${d.tier ?? 0}`, onclick: () => { modal?.close(); modal = null; world.chooseSkill(id); } },
          d.tier ? h("div", { class: "lvup-tier" }, TIER_NAMES[d.tier]) : null,
          h("div", { class: "lvup-ico" }, d.icon),
          h("div", { class: "lvup-n" }, d.name, n ? h("small", null, ` ${n + 1}つめ`) : null),
          h("div", { class: "lvup-d" }, d.desc));
      })),
      h("button", { class: `btn btn-small ${world.rerolls ? "btn-pink" : "btn-gray"} lvup-re`, disabled: !world.rerolls, onclick: () => {
        if (world.reroll()) { modal?.close(); modal = null; showChoices(); }
      } }, `🎲 引きなおす（のこり ${world.rerolls}）`)), "ov-lvup");
  };

  /** 飼い主のごほうび（回復か おもちゃ）・のら猫ボスの 取り引き（体力の上限と 引きかえに スキル） */
  const showEvent = () => {
    const ev = world.event!;
    sfx("levelup");
    const pick = (c: Parameters<typeof world.chooseEvent>[0]) => () => { modal?.close(); modal = null; world.chooseEvent(c); };
    const skillCard = (id: (typeof ev.skills)[number], sub: string) => {
      const d = SKILL_MAP[id];
      return h("button", { class: `lvup-card tier${d.tier ?? 0}`, onclick: pick(id) }, d.tier ? h("div", { class: "lvup-tier" }, TIER_NAMES[d.tier]) : null, h("div", { class: "lvup-ico" }, d.icon), h("div", { class: "lvup-n" }, d.name), h("div", { class: "lvup-d" }, `${d.desc}${sub}`));
    };
    modal = ev.kind === "guard"
      ? overlay(h("div", { class: "lvup ev" },
        h("img", { class: "ev-cat", src: "cat/kuro/sit.png", alt: "" }),
        h("div", { class: "lvup-t" }, "タワーの番猫"),
        h("div", { class: "lvup-sub" }, "「よく のぼってきたな。ひとつ 技を さずけよう」"),
        h("div", { class: "lvup-cards" }, ev.skills.map((id) => skillCard(id, "")))), "ov-lvup ov-angel")
      : ev.kind === "angel"
      ? overlay(h("div", { class: "lvup ev" },
        h("div", { class: "ev-ico" }, "🙌"),
        h("div", { class: "lvup-t" }, "飼い主の ごほうび"),
        h("div", { class: "lvup-sub" }, "がんばってるね〜。どっちが いい？"),
        h("div", { class: "lvup-cards" },
          h("button", { class: "lvup-card", onclick: pick("heal") }, h("div", { class: "lvup-ico" }, "🍗"), h("div", { class: "lvup-n" }, "おやつ"), h("div", { class: "lvup-d" }, "体力を 40% 回復")),
          ev.skills.map((id) => skillCard(id, "（おもちゃ）")))), "ov-lvup ov-angel")
      : overlay(h("div", { class: "lvup ev" },
        h("img", { class: "ev-cat", src: "cat/taisho/sit.png", alt: "" }),
        h("div", { class: "lvup-t" }, "のら猫ボスの 取り引き"),
        h("div", { class: "lvup-sub" }, `「技を おしえてやる。そのかわり 体力の上限を ${Math.round(world.devilCost * 100)}% もらうぜ」`),
        h("div", { class: "lvup-cards" },
          ev.skills.map((id) => skillCard(id, `（体力の上限 -${Math.round(world.devilCost * 100)}%）`)),
          h("button", { class: "btn btn-ghost", onclick: pick("refuse") }, "ことわる"))), "ov-lvup ov-devil");
  };

  /** やられたとき: チュールで 1回だけ 起き上がれる */
  let askedRevive = false;
  const showRevive = () => {
    askedRevive = true;
    const can = save.churu >= REVIVE_COST;
    modal = overlay(h("div", { class: "result" },
      h("img", { class: "result-cat", src: `cat/${save.cat}/sleep.png`, alt: "" }),
      h("h2", null, "やられちゃった…"),
      h("p", { class: "muted small" }, `チュールで 元気を出して 続ける？（1回だけ・🍥 のこり ${fmt(save.churu)}）`),
      h("button", { class: `btn ${can ? "btn-gold" : "btn-gray"}`, disabled: !can, onclick: () => {
        if (save.churu < REVIVE_COST || !world.continueRun()) return;
        save.churu -= REVIVE_COST; writeSave(save);
        sfx("levelup"); modal?.close(); modal = null; endTimer = 0; askedRevive = false;
      } }, `🍥${REVIVE_COST} で 続ける`),
      h("button", { class: "btn btn-ghost", onclick: () => { modal?.close(); modal = null; showResult(); } }, "あきらめる")));
  };

  const showResult = () => {
    ended = true;
    const won = world.state === "won";
    sfx(won ? "clear" : "lose");
    const drops = world.drops;
    modal = overlay(h("div", { class: "result" },
      h("img", { class: "result-cat", src: `cat/${save.cat}/${won ? "jump" : "sleep"}.png`, alt: "" }),
      h("h2", null, won ? (mode ? `${mode.title} クリア！` : `第${chapter}章${hard ? " ハード" : ""} クリア！`) : "やられちゃった…"),
      h("div", { class: "result-st" }, mode?.tower ? (won ? `${world.stage}階まで のぼった` : `${world.stage}階で やられた（この${lastSt}階は 数えない）`) : won ? `${lastSt} / ${lastSt}` : `ステージ ${world.stage} / ${lastSt} まで`),
      mode ? null : h("div", { class: "result-rw" }, h("span", null, "🐟 にぼし"), h("b", null, `+${fmt(world.coins)}`)),
      !mode && world.churu ? h("div", { class: "result-rw" }, h("span", null, "🍥 チュール"), h("b", null, `+${fmt(world.churu)}`)) : null,
      !mode && drops.length ? h("div", { class: "result-items" }, drops.map((d) => h("div", { class: `icard r${d.r}` },
        h("div", { class: "icard-ico" }, ITEM_MAP[d.id].icon), h("div", { class: "icard-r" }, RARITY_NAMES[d.r])))) : null,
      !mode && world.runeDrops.length ? h("div", { class: "result-items" }, world.runeDrops.map((r) => runeCard(r))) : null,
      h("button", { class: "btn btn-gold", onclick: () => finish() }, "OK")));
  };

  const finish = () => {
    modal?.close();
    cleanup();
    onEnd({ stage: world.stage, won: world.state === "won", coins: world.coins, drops: world.drops, runeDrops: world.runeDrops, churu: world.churu, kills: world.kills, killsBy: world.killsBy });
  };

  // ---- ループ ----
  let raf = 0, last = performance.now(), acc = 0;
  const hudUpdate = () => {
    const hero = world.hero;
    if (hint && hint.isConnected && (hero.dist > 3 || world.time > 12)) hint.remove();
    stageEl.textContent = `${mode ? mode.title : `第${chapter}章${hard ? "★ハード" : ""} ${CHAPTER_NAMES[chapter - 1]}`}　${mode?.tower ? `${world.stage}階（${world.stage - mode.tower + 1} / ${lastSt}）` : `ステージ ${world.stage} / ${lastSt}`}`;
    hpFill.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    hpText.textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
    xpFill.style.width = `${Math.min(1, hero.xp / world.xpNeed()) * 100}%`;
    lvEl.textContent = `Lv${hero.level}`;
    const boss = world.enemies.find((e) => e.def.boss);
    bossBar.style.display = boss ? "" : "none";
    const dsc = world.lo.descent;
    descEl.style.display = dsc ? "" : "none";
    if (dsc) {
      descEl.textContent = world.descending ? `🔆 降臨「${DESCENT_NAMES[dsc.series]}」 ${Math.ceil(world.descentT)}秒` : `🔆 降臨 ${world.descentStacks} / 10`;
      descEl.classList.toggle("on", world.descending);
    }
    if (!ended) bgm(boss ? "boss" : music);
    if (boss) {
      (bossBar.firstChild as HTMLElement).textContent = boss.def.name;
      (bossBar.querySelector(".bar-fill") as HTMLElement).style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    }
  };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!paused && !modal && !ended) {
      acc += dt;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        world.step(1 / 60, input());
        for (const s of world.sounds) sfx(s);
        if (world.choices) { showChoices(); break; }
        if (world.event) { showEvent(); break; }
      }
      if (world.state === "dead" || world.state === "won") {
        endTimer += dt;
        if (endTimer > (world.state === "won" ? 1.2 : 0.9)) {
          if (world.state === "dead" && !world.paidRevive && !askedRevive) showRevive(); else showResult();
        }
      }
    } else acc = 0;
    ren.draw(world, stick);
    hudUpdate();
  };
  raf = requestAnimationFrame(frame);

  // 画面を離れたら 止める
  const onHide = () => { if (document.hidden && !modal && !ended) pauseBtn.click(); };
  document.addEventListener("visibilitychange", onHide);

  function cleanup(): void {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", kd);
    window.removeEventListener("keyup", ku);
    document.removeEventListener("visibilitychange", onHide);
    root.remove();
  }
}
