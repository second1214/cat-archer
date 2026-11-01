// 入り口: ホーム・装備の画面と、戦闘への切りかえ。
import "./style.css";
import { CATS, catName } from "./core/cats";
import { talentCost, TALENTS, talentValue, trainTalent } from "./core/talents";
import { ITEM_MAP, RARITY_NAMES } from "./core/equip";
import { mulberry32 } from "./core/rng";
import { CHEST_COST, claimDaily, finishRun, openChest } from "./core/run";
import { equippedSet, loadoutOf, loadSave, powerOf, resetSave, writeSave } from "./core/save";
import { mergePartners } from "./core/equip";
import { runePartners } from "./core/run";
import { CHAPTER_NAMES, ENEMIES, newEnemiesIn, STAGES_PER_CHAPTER } from "./core/stages";
import { loadCatImages } from "./game/render";
import { startBattle } from "./ui/battle";
import { openDaily } from "./ui/daily";
import { openTower } from "./ui/tower";
import { openRecords } from "./ui/records";
import { recordsReady } from "./core/records";
import { HARD_FIRST_CHURU, hardOpen } from "./core/run";
import { claimPatrol, patrolPending, PATROL_MAX_H } from "./core/patrol";
import { claimBonus, claimMission, MISSION_BONUS, missionState, MISSIONS } from "./core/missions";
import { DAILIES, DAILY_TRIES, dailyOpen, todayStr, triesLeft } from "./core/daily";
import { TOWER_UNLOCK } from "./core/tower";
import { fmt, h, helpBtn, overlay, toast } from "./ui/dom";
import { renderEquip } from "./ui/equip";
import { renderGacha } from "./ui/gacha";
import { runeCard } from "./ui/runes";
import { GRADE_NAMES, RUNE_MAP } from "./core/runes";
import { bgm, isMuted, setMuted, sfx, unlockAudio } from "./ui/sfx";

const save = loadSave();
type Tab = "shop" | "equip" | "home" | "challenge" | "train";
let tab: Tab = "home";
const app = document.getElementById("app")!;
const shell = h("div", { class: "shell" });
app.append(shell);
document.addEventListener("pointerdown", unlockAudio, { once: true });
void loadCatImages(save.cat);

let lastTab: Tab = "home";
/** ホームで ハードを 選んでいるか */
let hard = false;

// ---- 赤い しるし（受け取れる物・まだ 遊べる物） ----
const patrolReady = () => !save.patrolAt || patrolPending(save, Date.now()).hours >= 1;
const homeBadge = () => missionReady() || recordsReady(save) || patrolReady();
const challengeBadge = () => {
  const t = todayStr();
  const daily = DAILIES.some((d) => dailyOpen(save, d.id) && triesLeft(save, d.id, t) > 0);
  const back = save.unlocked >= TOWER_UNLOCK && save.towerPaidTo < save.towerBest;
  return daily || back;
};
/** ショップ: 10回 願えるとき */
const shopBadge = () => save.wishBells >= 10;
/** 装備: 合成できる 装備・ルーンが あるとき */
const equipBadge = () => {
  const eq = equippedSet(save);
  return save.items.some((x) => mergePartners(save.items, x, eq)) || save.runes.some((x) => runePartners(save, x, false));
};

function render(): void {
  // 同じタブを 描きなおすときは スクロールの位置を 保つ（合成・分解のたびに 上に戻らないように）
  const keep = lastTab === tab ? shell.querySelector(".screen")?.scrollTop ?? 0 : 0;
  lastTab = tab;
  bgm("home");
  const body = tab === "home" ? renderHome() : tab === "equip" ? renderEquip(save, render)
    : tab === "shop" ? renderGacha(save, render, chestCard()) : tab === "challenge" ? renderChallenge() : renderTrain();
  // 今いる タブには しるしを 出さない
  const navBtn = (t: Tab, icon: string, label: string, badge = false) =>
    h("button", { class: `${tab === t ? "on" : ""} ${t === "home" ? "nav-main" : ""}`, onclick: () => { tab = t; sfx("tap"); render(); } },
      h("span", null, icon), label, badge && tab !== t ? h("i", { class: "nav-dot" }) : null);
  shell.replaceChildren(
    h("header", { class: "top" },
      h("div", { class: "money" },
        res("🐟", save.coins, "にぼし", "強化・修行・宝箱に使う。ステージ・パトロール・にぼし倉庫で もらえる"),
        res("🍥", save.churu, "チュール", "ガチャ（おみやげ・おみくじ）と 復活に使う。毎日・ステージ・ボス・章クリア・ミッション・パトロールで もらえる"),
        res("🪨", save.stones, "爪とぎ石", "ルーンの 付与に使う。5章から ステージ・爪とぎの祠・タワー・パトロールで もらえる"),
        res("🔔", save.wishBells, "ねがいの鈴", "宝物の 願いに使う。キャットタワー・毎日のミッション・実績で もらえる")),
      h("button", { class: "mute", "aria-label": "設定", onclick: openSettings }, "⚙️")),
    body,
    h("nav", { class: "tabs five" },
      navBtn("shop", "🛒", "ショップ", shopBadge()),
      navBtn("equip", "🎒", "装備", equipBadge()),
      navBtn("home", "⚔️", "冒険", homeBadge()),
      navBtn("challenge", "🏆", "挑戦", challengeBadge()),
      navBtn("train", "💪", "修行")));
  const sc = shell.querySelector(".screen");
  if (sc) sc.scrollTop = keep;
}

/** 上の 資源（タップで 使いみち） */
function res(icon: string, v: number, name: string, desc: string): HTMLElement {
  return h("button", { class: "coins", onclick: () => toast(`${icon} ${name}: ${desc}`) }, `${icon} `, h("b", null, fmt(v)));
}

/** 丸い アイコンの ボタン（ホームの 左右） */
function sideBtn(icon: string, label: string, onclick: () => void, badge = false): HTMLElement {
  return h("button", { class: "side-btn", onclick: () => { sfx("tap"); onclick(); } }, h("span", { class: "side-ico" }, icon), h("small", null, label), badge ? h("i", { class: "nav-dot" }) : null);
}

function renderHome(): HTMLElement {
  const ch = save.chapter;
  const canHard = hardOpen(save, ch);
  if (!canHard) hard = false;
  const best = (hard ? save.hardBest[ch] : save.best[ch]) ?? 0;
  const lo = loadoutOf(save);
  const setCh = (v: number) => { save.chapter = Math.max(1, Math.min(save.unlocked, v)); writeSave(save); render(); };
  return h("div", { class: "screen home" },
    h("div", { class: "hero-stage" },
      h("div", { class: "side-col" },
        sideBtn("📋", "ミッション", openMissions, missionReady()),
        sideBtn("🐾", "パトロール", openPatrol, patrolReady()),
        sideBtn("📖", "記録", () => openRecords(save, render), recordsReady(save))),
      h("div", { class: "hero-mid" },
        h("img", { class: "hero-cat", src: `cat/${save.cat}/sit.png`, alt: catName(save.cat) }),
        h("div", { class: "hero-pow" }, "戦力 ", h("b", null, fmt(powerOf(lo))))),
      h("div", { class: "side-col" },
        sideBtn("🐱", "ねこ", pickCat),
        sideBtn("🏋️", "修行", () => { tab = "train"; render(); }))),
    h("div", { class: "ch-card" },
      h("button", { class: "ch-arrow", disabled: ch <= 1, onclick: () => setCh(ch - 1) }, "◀"),
      h("div", { class: "ch-mid" },
        h("div", { class: "ch-no" }, `第${ch}章`, hard ? h("span", { class: "ch-hard" }, " ★ハード") : null),
        h("div", { class: "ch-name" }, CHAPTER_NAMES[ch - 1]),
        h("div", { class: "ch-best" }, best >= STAGES_PER_CHAPTER ? "クリア済み ⭐" : `最高 ${best} / ${STAGES_PER_CHAPTER}`),
        canHard ? h("div", { class: "ch-mode" },
          h("button", { class: hard ? "" : "on", onclick: () => { hard = false; sfx("tap"); render(); } }, "ノーマル"),
          h("button", { class: hard ? "on hard" : "", onclick: () => { hard = true; sfx("tap"); render(); } }, "ハード")) : null,
        hard && best < STAGES_PER_CHAPTER ? h("div", { class: "ch-new" }, `敵 体力×3・攻撃×2。にぼし×2・はじめてのクリアで 🍥${HARD_FIRST_CHURU}`) : null,
        !hard && newEnemiesIn(ch).length ? h("div", { class: "ch-new" }, "新しい虫: ", newEnemiesIn(ch).map((k, i) => h("span", { class: "nowrap" }, (i ? "・" : "") + ENEMIES[k].name))) : null),
      h("button", { class: "ch-arrow", disabled: ch >= save.unlocked, onclick: () => setCh(ch + 1) }, "▶")),
    save.unlocked === 1 && !save.best[1] ? h("div", { class: "how-bubble" }, "まずは「出発！」。指で 動かして、止まると 自動で 撃つよ") : null,
    h("button", { class: `btn btn-play ${hard ? "hard" : ""}`, onclick: () => play(ch, hard) }, hard ? "ハードで 出発！" : "出発！"));
}

/** 挑戦: キャットタワー・毎日の挑戦 */
function renderChallenge(): HTMLElement {
  const t = todayStr();
  const card = (icon: string, name: string, sub: string, status: string, open: boolean, lockText: string, go: () => void, badge = false) =>
    h("button", { class: `chl-card ${open ? "" : "off"}`, onclick: () => { if (!open) { toast(lockText); return; } sfx("tap"); go(); } },
      h("div", { class: "chl-ico" }, icon),
      h("div", { class: "chl-mid" }, h("b", null, name), h("small", null, open ? sub : lockText)),
      h("div", { class: "chl-st" }, open ? status : "🔒"),
      badge ? h("i", { class: "nav-dot" }) : null);
  const back = save.towerPaidTo < save.towerBest;
  return h("div", { class: "screen chl" },
    h("h2", { class: "scr-h" }, "挑戦"),
    card("🗼", "キャットタワー", "1回 5階。階ごとに スキル、5階めは ボス。25階ごとに 大きな ごほうび",
      back ? "受け取れる！" : `${save.towerBest}階`, save.unlocked >= TOWER_UNLOCK, `第${TOWER_UNLOCK}章で 解放`, () => openTower(save, render, shell), back),
    DAILIES.map((d) => {
      const left = dailyOpen(save, d.id) ? triesLeft(save, d.id, t) : 0;
      return card(d.icon, d.name, d.desc, `のこり ${left}/${DAILY_TRIES}`, dailyOpen(save, d.id), `第${d.unlock}章で 解放`, () => openDaily(save, render, shell), left > 0);
    }));
}

/** 修行（タレント） */
function renderTrain(): HTMLElement {
  return h("div", { class: "screen train" },
    h("h2", { class: "scr-h" }, "ねこ修行 ", helpBtn("ねこ修行", "にぼしで ずっと残る力を 少しずつ 上げます。", "どれも 最大 Lv30。レベルが 上がるほど にぼしが いります。")),
    h("div", { class: "tl-list" }, TALENTS.map((tl) => {
      const lv = save.talents[tl.id], cost = talentCost(lv);
      return h("div", { class: "tl-row" },
        h("div", { class: "tl-ico" }, tl.icon),
        h("div", { class: "tl-mid" },
          h("b", null, `${tl.name} Lv${lv}`),
          h("small", null, lv ? tl.desc(talentValue(tl.id, lv)) : "まだ 修行していない"),
          cost !== null ? h("small", { class: "tl-next" }, `→ ${tl.desc(talentValue(tl.id, lv + 1))}`) : h("small", { class: "tl-next" }, "最大")),
        h("button", { class: `btn btn-small ${cost !== null && save.coins >= cost ? "btn-gold" : "btn-gray"}`, disabled: cost === null || save.coins < cost, onclick: () => {
          if (trainTalent(save, tl.id)) { writeSave(save); sfx("coin"); render(); }
        } }, cost === null ? "最大" : `🐟${fmt(cost)}`));
    })));
}

function openPatrol(): void {
  const p = patrolPending(save, Date.now());
  const hh = Math.floor(p.hours), mm = Math.floor((p.hours - hh) * 60);
  const m = overlay(h("div", { class: "pick" },
    h("h2", null, "🐾 パトロール"),
    h("p", { class: "muted small" }, `遊んでいない あいだも 近所を 見回って 集めてくる（${PATROL_MAX_H}時間まで たまる）`),
    save.patrolAt ? h("div", { class: "tw-best" }, `${hh}時間${mm}分`) : null,
    h("div", { class: "tw-next small" }, save.patrolAt ? [p.coins ? `🐟${fmt(p.coins)}` : "", p.churu ? `🍥${p.churu}` : "", p.stones ? `🪨${p.stones}` : ""].filter(Boolean).join("・") || "まだ たまっていない" : "はじめると 時間で たまります"),
    h("button", { class: `btn ${!save.patrolAt || p.coins ? "btn-gold" : "btn-gray"} btn-wide`, disabled: !!save.patrolAt && !p.coins, onclick: () => {
      const r = claimPatrol(save, Date.now());
      writeSave(save); sfx("coin"); m.close(); render();
      toast(r.coins ? `パトロール: 🐟${fmt(r.coins)}${r.churu ? ` 🍥${r.churu}` : ""}${r.stones ? ` 🪨${r.stones}` : ""}` : "パトロールに 出かけた");
    } }, save.patrolAt ? "受け取る" : "はじめる"),
    h("button", { class: "btn btn-ghost btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}

/** 設定: 音・データの リセット */
function openSettings(): void {
  sfx("tap");
  const m = overlay(h("div", { class: "pick" },
    h("h2", null, "⚙️ 設定"),
    h("button", { class: "btn btn-wide", onclick: () => { setMuted(!isMuted()); m.close(); render(); openSettings(); } }, isMuted() ? "🔇 音: なし（タップで あり）" : "🔊 音: あり（タップで なし）"),
    h("button", { class: "btn btn-wide", onclick: () => { m.close(); openHowTo(); } }, "❓ 遊び方"),
    h("button", { class: "btn btn-wide danger", onclick: () => { m.close(); confirmReset(); } }, "🗑️ 冒険の記録を ぜんぶ 消す"),
    h("button", { class: "btn btn-ghost btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}

function openHowTo(): void {
  const m = overlay(h("div", { class: "pick help" },
    h("h2", null, "遊び方"),
    ["⚔️ 冒険: 章を えらんで 出発。指を すべらせて 動き、止まると 自動で 撃つ。レベルが 上がるたびに スキルを 3つから 1つ。",
      "🎒 装備: 同じ装備 3つで 合成して 品質アップ。ルーンは 5章から、宝物は 願いで 集める。",
      "🏆 挑戦: キャットタワー（8章〜）と 毎日の挑戦（3章〜）。ルーンや 神鍛の 材料が 手に入る。",
      "💪 修行: にぼしで ずっと残る 力を 上げる。",
      "🛒 ショップ: 宝箱・おみやげ（装備）・おみくじ（ルーン）・願い（宝物）。",
      "上の 🐟🍥🪨🔔 を タップすると 使いみちが 出ます。"].map((t) => h("p", { class: "help-p" }, t)),
    h("button", { class: "btn btn-ghost btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}

function confirmReset(): void {
  const m = overlay(h("div", { class: "pick" },
    h("h2", null, "ほんとうに 消しますか？"),
    h("p", { class: "small" }, "装備・ルーン・宝物・章の記録・チュール など ぜんぶ 消えて、第1章から はじめます。もとに もどせません。"),
    h("button", { class: "btn btn-wide danger", onclick: () => {
      m.close();
      const m2 = overlay(h("div", { class: "pick" },
        h("h2", null, "さいごの 確認"),
        h("p", { class: "small" }, "もう一度 押すと 消えます。"),
        h("button", { class: "btn btn-wide danger", onclick: () => { resetSave(); location.reload(); } }, "消して はじめから"),
        h("button", { class: "btn btn-ghost btn-wide", onclick: () => m2.close() }, "やめる")), "", () => m2.close());
    } }, "消す"),
    h("button", { class: "btn btn-ghost btn-wide", onclick: () => m.close() }, "やめる")), "", () => m.close());
}

/** ショップの 宝箱 */
function chestCard(): HTMLElement {
  return h("div", { class: "shop-chest" },
    h("div", null, h("b", null, "🎁 宝箱"), h("small", { class: "muted" }, " 装備（ルーンが 出ることも）")),
    h("button", { class: `btn btn-small ${save.coins >= CHEST_COST ? "btn-gold" : "btn-gray"}`, disabled: save.coins < CHEST_COST, onclick: chest }, `🐟${CHEST_COST}`));
}

const missionReady = () => {
  const m = missionState(save);
  return MISSIONS.some((d) => m.prog[d.id] >= d.goal && !m.claimed.includes(d.id)) || (!m.bonus && m.claimed.length === MISSIONS.length);
};

function openMissions(): void {
  sfx("tap");
  const body = h("div", { class: "pick" });
  const draw = () => {
    const m = missionState(save);
    body.replaceChildren(
      h("h2", null, "毎日のミッション"),
      h("div", { class: "tl-list" }, MISSIONS.map((d) => {
        const v = Math.min(d.goal, m.prog[d.id]), got = m.claimed.includes(d.id);
        return h("div", { class: "tl-row" },
          h("div", { class: "tl-mid" }, h("b", null, d.name), h("div", { class: "bar ms-bar" }, h("div", { class: "bar-fill xp", style: `width:${(v / d.goal) * 100}%` })), h("small", null, `${v} / ${d.goal}`)),
          h("button", { class: `btn btn-small ${!got && v >= d.goal ? "btn-gold" : "btn-gray"}`, disabled: got || v < d.goal, onclick: () => {
            if (claimMission(save, d.id)) { writeSave(save); sfx("coin"); draw(); }
          } }, got ? "✓ 済み" : `🍥${d.churu}`));
      })),
      h("button", { class: `btn ${!m.bonus && m.claimed.length === MISSIONS.length ? "btn-pink" : "btn-gray"} btn-wide`, disabled: m.bonus || m.claimed.length < MISSIONS.length, onclick: () => {
        if (claimBonus(save)) { writeSave(save); sfx("levelup"); draw(); }
      } }, m.bonus ? "ぜんぶ達成 済み" : `ぜんぶ達成で 🍥${MISSION_BONUS.churu}・🪨${MISSION_BONUS.stones}・🔔${MISSION_BONUS.bells}`),
      h("button", { class: "btn btn-ghost btn-wide", onclick: () => { mm.close(); render(); } }, "とじる"));
  };
  draw();
  const mm = overlay(body, "", () => { mm.close(); render(); });
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
    h("button", { class: "btn btn-ghost btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
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

function play(chapter: number, hardMode = false): void {
  sfx("tap");
  shell.style.display = "none";
  startBattle(save, chapter, (r) => {
    const rw = finishRun(save, { chapter, stage: r.stage, won: r.won, coins: r.coins, drops: r.drops, runeDrops: r.runeDrops, churu: r.churu, kills: r.kills, killsBy: r.killsBy, hard: hardMode });
    writeSave(save);
    shell.style.display = "";
    render();
    const got = [rw.churu ? `🍥+${rw.churu}` : "", rw.stones ? `🪨+${rw.stones}` : ""].filter(Boolean).join(" ");
    const head = rw.unlocked ? `第${rw.unlocked}章「${CHAPTER_NAMES[rw.unlocked - 1]}」へ 行けるように なった！` : rw.newBest ? "最高記録 こうしん！" : "";
    if (head || got) toast([head, got].filter(Boolean).join("　"));
  }, undefined, hardMode);
}

render();
// 1日1回の チュール
{
  const d = new Date();
  const got = claimDaily(save, todayStr(d));
  if (got) { writeSave(save); render(); toast(`きょうの チュール 🍥+${got}`); }
}
