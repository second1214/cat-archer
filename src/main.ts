// 入り口: ホーム・装備の画面と、戦闘への切りかえ。
import "./style.css";
import { CATS, catName } from "./core/cats";
import { talentCost, TALENTS, talentValue, trainTalent } from "./core/talents";
import { ITEM_MAP, RARITY_NAMES } from "./core/equip";
import { mulberry32 } from "./core/rng";
import { CHEST_COST, claimDaily, finishRun, openChest } from "./core/run";
import { loadoutOf, loadSave, powerOf, writeSave } from "./core/save";
import { CHAPTER_NAMES, ENEMIES, newEnemiesIn, STAGES_PER_CHAPTER } from "./core/stages";
import { loadCatImages } from "./game/render";
import { startBattle } from "./ui/battle";
import { openDaily } from "./ui/daily";
import { todayStr } from "./core/daily";
import { fmt, h, overlay, toast } from "./ui/dom";
import { renderEquip } from "./ui/equip";
import { renderGacha } from "./ui/gacha";
import { runeCard } from "./ui/runes";
import { GRADE_NAMES, RUNE_MAP } from "./core/runes";
import { isMuted, setMuted, sfx, unlockAudio } from "./ui/sfx";

const save = loadSave();
let tab: "home" | "equip" | "gacha" = "home";
const app = document.getElementById("app")!;
const shell = h("div", { class: "shell" });
app.append(shell);
document.addEventListener("pointerdown", unlockAudio, { once: true });
void loadCatImages(save.cat);

let lastTab: "home" | "equip" | "gacha" = "home";
function render(): void {
  // 同じタブを 描きなおすときは スクロールの位置を 保つ（合成・分解のたびに 上に戻らないように）
  const keep = lastTab === tab ? shell.querySelector(".screen")?.scrollTop ?? 0 : 0;
  lastTab = tab;
  const body = tab === "home" ? renderHome() : tab === "equip" ? renderEquip(save, render) : renderGacha(save, render);
  shell.replaceChildren(
    h("header", { class: "top" },
      h("div", { class: "money" }, h("div", { class: "coins" }, "🐟 ", h("b", null, fmt(save.coins))), h("div", { class: "coins" }, "🍥 ", h("b", null, fmt(save.churu)))),
      h("button", { class: "mute", "aria-label": "音", onclick: () => { setMuted(!isMuted()); render(); } }, isMuted() ? "🔇" : "🔊")),
    body,
    h("nav", { class: "tabs" },
      h("button", { class: tab === "home" ? "on" : "", onclick: () => { tab = "home"; sfx("tap"); render(); } }, h("span", null, "🏠"), "ホーム"),
      h("button", { class: tab === "equip" ? "on" : "", onclick: () => { tab = "equip"; sfx("tap"); render(); } }, h("span", null, "🎒"), "装備"),
      h("button", { class: tab === "gacha" ? "on" : "", onclick: () => { tab = "gacha"; sfx("tap"); render(); } }, h("span", null, "🎁"), "おみやげ")));
  const sc = shell.querySelector(".screen");
  if (sc) sc.scrollTop = keep;
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
        h("button", { class: "btn btn-small hero-pick", onclick: pickCat }, "🐾 ", catName(save.cat)),
        h("button", { class: "btn btn-small hero-pick", onclick: openTraining }, "🏋️ 修行"),
        h("button", { class: "btn btn-small hero-pick", onclick: () => { sfx("tap"); openDaily(save, render, shell); } }, "📅 毎日"))),
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

function openTraining(): void {
  sfx("tap");
  const body = h("div", { class: "pick" });
  const draw = () => body.replaceChildren(
    h("h2", null, "ねこ修行"),
    h("p", { class: "muted small" }, "にぼしで ずっと残る力を 少しずつ 上げる"),
    h("div", { class: "coins tr-coins" }, "🐟 ", h("b", null, fmt(save.coins))),
    h("div", { class: "tl-list" }, TALENTS.map((t) => {
      const lv = save.talents[t.id], cost = talentCost(lv);
      return h("div", { class: "tl-row" },
        h("div", { class: "tl-ico" }, t.icon),
        h("div", { class: "tl-mid" },
          h("b", null, `${t.name} Lv${lv}`),
          h("small", null, lv ? t.desc(talentValue(t.id, lv)) : "まだ 修行していない"),
          cost !== null ? h("small", { class: "tl-next" }, `→ ${t.desc(talentValue(t.id, lv + 1))}`) : h("small", { class: "tl-next" }, "最大")),
        h("button", { class: `btn btn-small ${cost !== null && save.coins >= cost ? "btn-gold" : "btn-gray"}`, disabled: cost === null || save.coins < cost, onclick: () => {
          if (trainTalent(save, t.id)) { writeSave(save); sfx("coin"); draw(); }
        } }, cost === null ? "最大" : `🐟${fmt(cost)}`));
    })),
    h("button", { class: "btn btn-gray btn-wide", onclick: () => { m.close(); render(); } }, "とじる"));
  draw();
  const m = overlay(body, "", () => { m.close(); render(); });
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
  const isRune = "g" in it;
  const m = overlay(h("div", { class: "result" },
    h("h2", null, "宝箱"),
    isRune ? runeCard(it) : h("div", { class: `icard big r${it.r}` }, h("div", { class: "icard-ico" }, ITEM_MAP[it.id].icon)),
    h("div", { class: "result-st" }, isRune ? `ルーン「${RUNE_MAP[it.id].name}」（${GRADE_NAMES[it.g]}）` : `${ITEM_MAP[it.id].name}（${RARITY_NAMES[it.r]}）`),
    h("button", { class: "btn btn-gold", onclick: () => { m.close(); render(); } }, "OK")), "", () => { m.close(); render(); });
}

function play(chapter: number): void {
  sfx("tap");
  shell.style.display = "none";
  startBattle(save, chapter, (r) => {
    const rw = finishRun(save, { chapter, stage: r.stage, won: r.won, coins: r.coins, drops: r.drops, runeDrops: r.runeDrops, churu: r.churu });
    writeSave(save);
    shell.style.display = "";
    render();
    if (rw.unlocked) toast(`第${rw.unlocked}章「${CHAPTER_NAMES[rw.unlocked - 1]}」へ行けるようになった！`);
    else if (rw.newBest) toast("最高記録こうしん！");
    if (rw.churu) setTimeout(() => toast(`🍥 チュール +${rw.churu}`), rw.unlocked || rw.newBest ? 1900 : 0);
    if (rw.stones) setTimeout(() => toast(`🪨 爪とぎ石 +${rw.stones}`), 3800);
  });
}

render();
// 1日1回の チュール
{
  const d = new Date();
  const got = claimDaily(save, todayStr(d));
  if (got) { writeSave(save); render(); toast(`きょうの チュール 🍥+${got}`); }
}
