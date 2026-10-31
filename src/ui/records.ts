// 記録: 実績と 図鑑（ホームの「📖 記録」から）。
import { ACHIEVEMENTS, achReady, BESTIARY_KINDS, BESTIARY_STEPS, bestiaryNext, BUG_NOTES, claimAchievement, claimBestiary } from "../core/records";
import { writeSave, type SaveData } from "../core/save";
import { ENEMIES, type EnemyKind } from "../core/stages";
import { drawBug } from "../game/render";
import { fmt, h, overlay } from "./dom";
import { sfx } from "./sfx";

let tab: "ach" | "dex" = "ach";

function bugIcon(k: EnemyKind, seen: boolean): HTMLCanvasElement {
  const c = h("canvas", { class: `dx-cv ${seen ? "" : "unseen"}`, width: 64, height: 64 });
  const g = c.getContext("2d");
  if (g) {
    g.translate(32, 32);
    if (!seen) g.filter = "brightness(0)";
    drawBug(g, k, ENEMIES[k].boss ? 22 : 18, 0.3);
  }
  return c;
}

export function openRecords(save: SaveData, rerender: () => void): void {
  const body = h("div", { class: "pick rec" });
  const draw = () => {
    const tabs = h("div", { class: "eq-tabs" },
      h("button", { class: tab === "ach" ? "on" : "", onclick: () => { tab = "ach"; draw(); } }, "実績"),
      h("button", { class: tab === "dex" ? "on" : "", onclick: () => { tab = "dex"; draw(); } }, "図鑑"));
    const list = tab === "ach"
      ? h("div", { class: "tl-list" }, ACHIEVEMENTS.map((a) => {
        const got = save.achievements.includes(a.id), ready = achReady(save, a);
        const [v, goal] = a.progress?.(save) ?? [a.done(save) ? 1 : 0, 1];
        return h("div", { class: `tl-row ${got ? "rec-got" : ""}` },
          h("div", { class: "tl-mid" }, h("b", null, a.name),
            goal > 1 ? h("div", { class: "bar ms-bar" }, h("div", { class: "bar-fill xp", style: `width:${Math.min(1, v / goal) * 100}%` })) : null,
            h("small", null, [goal > 1 ? `${fmt(Math.min(v, goal))} / ${fmt(goal)}　` : "", a.churu ? `🍥${a.churu} ` : "", a.stones ? `🪨${a.stones}` : ""].join(""))),
          h("button", { class: `btn btn-small ${ready ? "btn-gold" : "btn-gray"}`, disabled: !ready, onclick: () => {
            if (claimAchievement(save, a.id)) { writeSave(save); sfx("coin"); draw(); }
          } }, got ? "済み" : "受け取る"));
      }))
      : h("div", { class: "dx-grid" }, BESTIARY_KINDS.map((k) => {
        const n = save.bestiary[k] ?? 0, seen = n > 0, nx = bestiaryNext(save, k);
        return h("div", { class: `dx-cell ${ENEMIES[k].boss ? "boss" : ""}` },
          bugIcon(k, seen),
          h("b", null, seen ? ENEMIES[k].name : "？？？"),
          h("small", { class: "muted" }, seen ? BUG_NOTES[k] : "まだ 会っていない"),
          h("small", null, `${fmt(n)}匹`),
          nx ? h("button", { class: `btn btn-small ${nx.ready ? "btn-gold" : "btn-gray"}`, disabled: !nx.ready, onclick: () => {
            if (claimBestiary(save, k)) { writeSave(save); sfx("coin"); draw(); }
          } }, `${BESTIARY_STEPS[nx.step].kills}匹 🍥${nx.churu}`) : h("small", { class: "muted" }, "コンプリート"));
      }));
    body.replaceChildren(h("h2", null, "📖 記録"), tabs, list,
      h("button", { class: "btn btn-gray btn-wide", onclick: () => { m.close(); rerender(); } }, "とじる"));
  };
  draw();
  const m = overlay(body, "", () => { m.close(); rerender(); });
}
