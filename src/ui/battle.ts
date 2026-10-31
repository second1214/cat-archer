// 戦闘の画面: canvas・スティック・HUD・レベルアップの3択・一時停止・結果。
import { ITEM_MAP, RARITY_NAMES, type Item } from "../core/equip";
import { mulberry32 } from "../core/rng";
import { loadoutOf, type SaveData } from "../core/save";
import { SKILL_MAP } from "../core/skills";
import { CHAPTER_NAMES, STAGES_PER_CHAPTER } from "../core/stages";
import { loadCatImages, Renderer, type Stick } from "../game/render";
import { World } from "../game/world";
import { fmt, h, overlay } from "./dom";
import { sfx } from "./sfx";

export interface BattleEnd { stage: number; won: boolean; coins: number; drops: Item[] }

export function startBattle(save: SaveData, chapter: number, onEnd: (r: BattleEnd) => void): void {
  void loadCatImages(save.cat);
  const world = new World(loadoutOf(save), chapter, mulberry32((save.seed = (save.seed * 16807 + 11) % 2147483647)));
  const cv = h("canvas", { class: "bt-cv" });
  const stageEl = h("div", { class: "bt-stage" });
  const hpFill = h("div", { class: "bar-fill hp" });
  const hpText = h("span", { class: "bar-t" });
  const xpFill = h("div", { class: "bar-fill xp" });
  const lvEl = h("span", { class: "bt-lv" });
  const bossBar = h("div", { class: "bt-boss" }, h("div", { class: "bt-boss-n" }), h("div", { class: "bar" }, h("div", { class: "bar-fill boss" })));
  const pauseBtn = h("button", { class: "bt-pause", "aria-label": "一時停止" }, h("i"), h("i"));
  const root = h("div", { class: "battle" }, cv,
    h("div", { class: "bt-hud" },
      h("div", { class: "bt-top" }, stageEl, pauseBtn),
      h("div", { class: "bar bt-hp" }, hpFill, hpText),
      h("div", { class: "bt-xprow" }, lvEl, h("div", { class: "bar bt-xp" }, xpFill)),
      bossBar));
  document.getElementById("app")!.append(root);

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
      h("button", { class: "btn btn-gray", onclick: () => { modal?.close(); modal = null; world.state = "dead"; world.hero.hp = 0; } }, "あきらめる")));
  });

  const showChoices = () => {
    const ch = world.choices!;
    sfx("levelup");
    modal = overlay(h("div", { class: "lvup" },
      h("div", { class: "lvup-t" }, `レベル ${world.hero.level - world.pendingLevels + 1}！`),
      h("div", { class: "lvup-sub" }, "スキルを1つえらんでね"),
      h("div", { class: "lvup-cards" }, ch.map((id) => {
        const d = SKILL_MAP[id], n = world.skills[id] ?? 0;
        return h("button", { class: "lvup-card", onclick: () => { modal?.close(); modal = null; world.chooseSkill(id); } },
          h("div", { class: "lvup-ico" }, d.icon),
          h("div", { class: "lvup-n" }, d.name, n ? h("small", null, ` ${n + 1}つめ`) : null),
          h("div", { class: "lvup-d" }, d.desc));
      }))), "ov-lvup");
  };

  const showResult = () => {
    ended = true;
    const won = world.state === "won";
    sfx(won ? "clear" : "lose");
    const drops = world.drops;
    modal = overlay(h("div", { class: "result" },
      h("img", { class: "result-cat", src: `cat/${save.cat}/${won ? "jump" : "sleep"}.png`, alt: "" }),
      h("h2", null, won ? `第${chapter}章 クリア！` : "やられちゃった…"),
      h("div", { class: "result-st" }, won ? `${STAGES_PER_CHAPTER} / ${STAGES_PER_CHAPTER}` : `ステージ ${world.stage} / ${STAGES_PER_CHAPTER} まで`),
      h("div", { class: "result-rw" }, h("span", null, "🐟 にぼし"), h("b", null, `+${fmt(world.coins)}`)),
      drops.length ? h("div", { class: "result-items" }, drops.map((d) => h("div", { class: `icard r${d.r}` },
        h("div", { class: "icard-ico" }, ITEM_MAP[d.id].icon), h("div", { class: "icard-r" }, RARITY_NAMES[d.r])))) : null,
      h("button", { class: "btn btn-gold", onclick: () => finish() }, "OK")));
  };

  const finish = () => {
    modal?.close();
    cleanup();
    onEnd({ stage: world.stage, won: world.state === "won", coins: world.coins, drops: world.drops });
  };

  // ---- ループ ----
  let raf = 0, last = performance.now(), acc = 0;
  const hudUpdate = () => {
    const hero = world.hero;
    stageEl.textContent = `第${chapter}章 ${CHAPTER_NAMES[chapter - 1]}　${world.stage} / ${STAGES_PER_CHAPTER}`;
    hpFill.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
    hpText.textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
    xpFill.style.width = `${Math.min(1, hero.xp / world.xpNeed()) * 100}%`;
    lvEl.textContent = `Lv${hero.level}`;
    const boss = world.enemies.find((e) => e.def.boss);
    bossBar.style.display = boss ? "" : "none";
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
      }
      if (world.state === "dead" || world.state === "won") {
        endTimer += dt;
        if (endTimer > (world.state === "won" ? 1.2 : 0.9)) showResult();
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
