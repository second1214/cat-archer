// 入り口: ホーム・装備の画面と、戦闘への切りかえ。
import "./style.css";
import { CATS, catName } from "./core/cats";
import { ITEM_MAP, RARITY_NAMES } from "./core/equip";
import { mulberry32 } from "./core/rng";
import { CHEST_COST, finishRun, openChest } from "./core/run";
import { loadoutOf, loadSave, powerOf, writeSave } from "./core/save";
import { CHAPTER_NAMES, ENEMIES, newEnemiesIn, STAGES_PER_CHAPTER } from "./core/stages";
import { loadCatImages } from "./game/render";
import { startBattle } from "./ui/battle";
import { fmt, h, overlay, toast } from "./ui/dom";
import { renderEquip } from "./ui/equip";
import { isMuted, setMuted, sfx, unlockAudio } from "./ui/sfx";

const save = loadSave();
let tab: "home" | "equip" = "home";
const app = document.getElementById("app")!;
const shell = h("div", { class: "shell" });
app.append(shell);
document.addEventListener("pointerdown", unlockAudio, { once: true });
void loadCatImages(save.cat);

function render(): void {
  const body = tab === "home" ? renderHome() : renderEquip(save, render);
  shell.replaceChildren(
    h("header", { class: "top" },
      h("div", { class: "coins" }, "🐟 ", h("b", null, fmt(save.coins))),
      h("button", { class: "mute", "aria-label": "音", onclick: () => { setMuted(!isMuted()); render(); } }, isMuted() ? "🔇" : "🔊")),
    body,
    h("nav", { class: "tabs" },
      h("button", { class: tab === "home" ? "on" : "", onclick: () => { tab = "home"; sfx("tap"); render(); } }, h("span", null, "🏠"), "ホーム"),
      h("button", { class: tab === "equip" ? "on" : "", onclick: () => { tab = "equip"; sfx("tap"); render(); } }, h("span", null, "🎒"), "装備")));
}

function renderHome(): HTMLElement {
  const ch = save.chapter;
  const best = save.best[ch] ?? 0;
  const lo = loadoutOf(save);
  const setCh = (v: number) => { save.chapter = Math.max(1, Math.min(save.unlocked, v)); writeSave(save); render(); };
  return h("div", { class: "screen home" },
    h("div", { class: "hero-card" },
      h("img", { class: "hero-cat", src: `cat/${save.cat}/sit.png`, alt: catName(save.cat) }),
      h("div", { class: "hero-row" },
        h("div", { class: "hero-pow" }, "戦力 ", h("b", null, fmt(powerOf(lo)))),
        h("button", { class: "btn btn-small hero-pick", onclick: pickCat }, "🐾 ", catName(save.cat)))),
    h("div", { class: "ch-card" },
      h("button", { class: "ch-arrow", disabled: ch <= 1, onclick: () => setCh(ch - 1) }, "◀"),
      h("div", { class: "ch-mid" },
        h("div", { class: "ch-no" }, `第${ch}章`),
        h("div", { class: "ch-name" }, CHAPTER_NAMES[ch - 1]),
        h("div", { class: "ch-best" }, best >= STAGES_PER_CHAPTER ? "クリア済み ⭐" : `最高 ${best} / ${STAGES_PER_CHAPTER}`),
        newEnemiesIn(ch).length ? h("div", { class: "ch-new" }, "新しい虫: ", newEnemiesIn(ch).map((k) => ENEMIES[k].name).join("・")) : null),
      h("button", { class: "ch-arrow", disabled: ch >= save.unlocked, onclick: () => setCh(ch + 1) }, "▶")),
    h("button", { class: "btn btn-play", onclick: () => play(ch) }, "出発！"),
    h("button", { class: `btn ${save.coins >= CHEST_COST ? "btn-pink" : "btn-gray"} chest`, disabled: save.coins < CHEST_COST, onclick: chest },
      "🎁 宝箱をあける ", h("small", null, `🐟${CHEST_COST}`)),
    h("p", { class: "muted small how" }, "指をすべらせて移動。止まると いちばん近い虫へ 自動で毛玉を撃ちます。"));
}

function pickCat(): void {
  sfx("tap");
  const m = overlay(h("div", { class: "pick" },
    h("h2", null, "ねこをえらぶ"),
    h("p", { class: "muted small" }, "見た目だけ変わります（強さは みんな同じ）"),
    h("div", { class: "pick-grid" }, CATS.map((c) => h("button", {
      class: `pick-cat ${c.id === save.cat ? "on" : ""}`,
      onclick: () => { save.cat = c.id; writeSave(save); void loadCatImages(c.id); sfx("tap"); m.close(); render(); },
    }, h("img", { src: `cat/${c.id}/sit.png`, alt: "", loading: "lazy" }), h("span", null, c.name)))),
    h("button", { class: "btn btn-gray btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}

function chest(): void {
  const it = openChest(save, mulberry32(Date.now() & 0x7fffffff));
  if (!it) return;
  writeSave(save);
  sfx("levelup");
  const d = ITEM_MAP[it.id];
  const m = overlay(h("div", { class: "result" },
    h("h2", null, "宝箱"),
    h("div", { class: `icard big r${it.r}` }, h("div", { class: "icard-ico" }, d.icon)),
    h("div", { class: "result-st" }, `${d.name}（${RARITY_NAMES[it.r]}）`),
    h("button", { class: "btn btn-gold", onclick: () => { m.close(); render(); } }, "OK")), "", () => { m.close(); render(); });
}

function play(chapter: number): void {
  sfx("tap");
  shell.style.display = "none";
  startBattle(save, chapter, (r) => {
    const rw = finishRun(save, { chapter, stage: r.stage, won: r.won, coins: r.coins, drops: r.drops });
    writeSave(save);
    shell.style.display = "";
    render();
    if (rw.unlocked) toast(`第${rw.unlocked}章「${CHAPTER_NAMES[rw.unlocked - 1]}」へ行けるようになった！`);
    else if (rw.newBest) toast("最高記録こうしん！");
  });
}

render();
