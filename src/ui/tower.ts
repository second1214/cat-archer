// キャットタワーの 画面（ホームから）。1回 5階、区切りの階に ボス。
import { addBestiary } from "../core/run";
import { track } from "../core/missions";
import { mulberry32 } from "../core/rng";
import { RUNE_MAP } from "../core/runes";
import { finishTower, floorReward, TOWER_FLOORS, TOWER_UNLOCK, towerChapter, towerRange, type TowerReward } from "../core/tower";
import { writeSave, type SaveData } from "../core/save";
import { startBattle } from "./battle";
import { fmt, h, overlay, toast } from "./dom";
import { sfx } from "./sfx";

const text = (r: Pick<TowerReward, "coins" | "churu" | "stones" | "epicMats" | "bells">) =>
  [r.bells ? `🔔${r.bells}` : "", r.coins ? `🐟${fmt(r.coins)}` : "", r.churu ? `🍥${r.churu}` : "", r.stones ? `🪨${r.stones}` : "", r.epicMats ? `エピックのルーン素材 ×${r.epicMats}` : ""].filter(Boolean).join("・");

export function openTower(save: SaveData, rerender: () => void, shell: HTMLElement): void {
  if (save.unlocked < TOWER_UNLOCK) { toast(`キャットタワーは 第${TOWER_UNLOCK}章で 解放`); return; }
  const [a, b] = towerRange(save);
  const sum = { coins: 0, churu: 0, stones: 0, epicMats: 0, bells: 0 };
  let rune = false;
  for (let f = a; f <= b; f++) { const r = floorReward(f); sum.coins += r.coins; sum.churu += r.churu; sum.stones += r.stones; sum.epicMats += r.epicMats; sum.bells += r.bells; rune ||= r.rune; }
  const nextBig = Math.ceil(a / 25) * 25;
  const m = overlay(h("div", { class: "pick" },
    h("h2", null, "🗼 キャットタワー"),
    h("p", { class: "muted small" }, `1回の挑戦で ${TOWER_FLOORS}階 のぼる。とちゅうで やられると その${TOWER_FLOORS}階は 数えない。階に はいるたびに スキルを1つ、クリアするたびに「タワーの番猫」が レア以上の スキルを1つ くれる（レベルアップは ない）。${TOWER_FLOORS}階めは ボス`),
    h("div", { class: "tw-best" }, "いちばん上 ", h("b", null, `${save.towerBest}階`)),
    h("div", { class: "small" }, `こんどは ${a}〜${b}階（第${towerChapter(a)}章くらい）`),
    h("div", { class: "tw-next small" },
      h("div", null, `${b}階まで のぼると: `, text(sum), rune ? "・エピックのルーン" : ""),
      h("div", { class: "muted" }, `${nextBig}階: 大きな ごほうび（🔔5・🍥50・🪨10・エピックのルーン素材×2・エピックのルーン）`)),
    h("button", { class: "btn btn-gold btn-wide", onclick: () => {
      m.close(); sfx("tap");
      shell.style.display = "none";
      startBattle(save, towerChapter(a), (r) => {
        const got = finishTower(save, r.won, mulberry32((Date.now() ^ (save.seed += 17)) & 0x7fffffff));
        track(save, "stages", r.won ? TOWER_FLOORS : 0); track(save, "kills", r.kills); addBestiary(save, r.killsBy);
        writeSave(save);
        shell.style.display = "";
        rerender();
        if (!got) return;
        toast(r.won ? `キャットタワー ${b}階まで のぼった！ ${text(got)}${got.runes.length ? `・${got.runes.map((x) => RUNE_MAP[x.id].name).join("・")}` : ""}` : `${r.stage}階で やられた… この${TOWER_FLOORS}階は 数えない`);
      }, { stages: TOWER_FLOORS, title: "キャットタワー", tower: a });
    } }, "のぼる"),
    h("button", { class: "btn btn-gray btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}
