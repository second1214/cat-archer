// キャットタワーの 画面（ホームから）。
import { finishTower, floorReward, TOWER_UNLOCK, towerChapter, towerStart, type TowerReward } from "../core/tower";
import { track } from "../core/missions";
import { writeSave, type SaveData } from "../core/save";
import { startBattle } from "./battle";
import { fmt, h, overlay, toast } from "./dom";
import { sfx } from "./sfx";

const text = (r: TowerReward) => [r.coins ? `🐟${fmt(r.coins)}` : "", r.churu ? `🍥${r.churu}` : "", r.stones ? `🪨${r.stones}` : "", r.epicMats ? `エピックのルーン素材 ×${r.epicMats}` : ""].filter(Boolean).join("・");

export function openTower(save: SaveData, rerender: () => void, shell: HTMLElement): void {
  if (save.unlocked < TOWER_UNLOCK) { toast(`キャットタワーは 第${TOWER_UNLOCK}章で 解放`); return; }
  const start = towerStart(save.towerBest);
  const next = Array.from({ length: 10 }, (_, i) => save.towerBest + 1 + i).filter((f) => f % 5 === 0).slice(0, 2);
  const m = overlay(h("div", { class: "pick" },
    h("h2", null, "🗼 キャットタワー"),
    h("p", { class: "muted small" }, "1階ずつ のぼる。終わりは ない。はじめて とどいた階で ごほうび。5階ごとに ボス、10階ごとに そこから はじめられる"),
    h("div", { class: "tw-best" }, "いちばん上 ", h("b", null, `${save.towerBest}階`)),
    h("div", { class: "small" }, `${start}階から はじめる（第${towerChapter(start)}章くらい）`, start > 1 ? `・はじめに スキル ${Math.floor((start - 1) / 10) * 3}回` : ""),
    h("div", { class: "tw-next small" }, next.map((f) => h("div", null, `${f}階: `, text(floorReward(f))))),
    h("button", { class: "btn btn-gold btn-wide", onclick: () => {
      m.close(); sfx("tap");
      shell.style.display = "none";
      startBattle(save, towerChapter(start), (r) => {
        const got = finishTower(save, r.stage - 1);
      track(save, "stages", r.stage - 1); track(save, "kills", r.kills);
        writeSave(save);
        shell.style.display = "";
        rerender();
        const t = text(got);
        toast(`キャットタワー ${r.stage - 1}階まで${t ? `: ${t}` : ""}`);
      }, { stages: Infinity, title: "キャットタワー", tower: start });
    } }, "のぼる"),
    h("button", { class: "btn btn-gray btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}
