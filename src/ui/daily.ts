// 毎日の挑戦の 画面（ホームから）。レベルを選んで 挑戦・掃討。
import { DAILIES, DAILY_STAGES, DAILY_TRIES, dailyOpen, dailyReward, finishDaily, levelChapter, maxLevel, sweepDaily, todayStr, triesLeft, type DailyId, type DailyReward } from "../core/daily";
import { GRADE_NAMES } from "../core/runes";
import { track } from "../core/missions";
import { addBestiary } from "../core/run";
import { writeSave, type SaveData } from "../core/save";
import { startBattle } from "./battle";
import { fmt, h, overlay, toast } from "./dom";
import { sfx } from "./sfx";

const rewardText = (r: DailyReward) => [
  r.coins ? `🐟 ${fmt(r.coins)}` : "",
  r.stones ? `🪨 ${fmt(r.stones)}` : "",
  r.mats ? `${GRADE_NAMES[r.mats.g]}の ルーン素材 ×${r.mats.n}` : "",
].filter(Boolean).join("・");

export function openDaily(save: SaveData, rerender: () => void, shell: HTMLElement): void {
  const pickLv: Record<DailyId, number> = { nibo: maxLevel(save, "nibo"), tsume: maxLevel(save, "tsume") };
  const body = h("div", { class: "pick daily" });
  const draw = () => {
    const today = todayStr();
    body.replaceChildren(...[
      h("h2", null, "毎日の挑戦"),
      h("p", { class: "muted small" }, `1日 ${DAILY_TRIES}回ずつ。${DAILY_STAGES}面（5面めは ボス）。やられても 進んだ分 もらえる`),
      DAILIES.map((d) => {
        if (!dailyOpen(save, d.id)) return h("div", { class: "dl-card off" }, h("b", null, `${d.icon} ${d.name}`), h("div", { class: "muted small" }, `🔒 第${d.unlock}章で 解放`));
        const left = triesLeft(save, d.id, today);
        const lv = pickLv[d.id], top = maxLevel(save, d.id), best = save.daily.best[d.id];
        const setLv = (v: number) => { pickLv[d.id] = Math.max(1, Math.min(top, v)); draw(); };
        return h("div", { class: "dl-card" },
          h("div", { class: "dl-h" }, h("b", null, `${d.icon} ${d.name}`), h("span", { class: `dl-left ${left ? "" : "none"}` }, `のこり ${left} / ${DAILY_TRIES}`)),
          h("div", { class: "muted small" }, d.desc),
          h("div", { class: "dl-lv" },
            h("button", { class: "ch-arrow", disabled: lv <= 1, onclick: () => setLv(lv - 1) }, "◀"),
            h("div", null, h("b", null, `レベル ${lv}`), h("small", { class: "muted" }, ` 第${levelChapter(lv)}章くらい${lv <= best ? "・クリア済み" : ""}`)),
            h("button", { class: "ch-arrow", disabled: lv >= top, onclick: () => setLv(lv + 1) }, "▶")),
          h("div", { class: "small" }, "クリアで: ", rewardText(dailyReward(d.id, lv, DAILY_STAGES))),
          h("div", { class: "item-btns two" },
            h("button", { class: `btn ${left ? "btn-gold" : "btn-gray"}`, disabled: !left, onclick: () => play(d.id, lv) }, "挑戦"),
            h("button", { class: `btn ${left && best ? "btn-pink" : "btn-gray"}`, disabled: !left || !best, onclick: () => {
              const r = sweepDaily(save, d.id, today);
              if (!r) return;
              writeSave(save); sfx("coin"); toast(`掃討（レベル${best}）: ${rewardText(r)}`); draw();
            } }, best ? `掃討 Lv${best}` : "掃討")));
      }),
      h("button", { class: "btn btn-gray btn-wide", onclick: () => { m.close(); rerender(); } }, "とじる")].flat());
  };
  const play = (id: DailyId, lv: number) => {
    const def = DAILIES.find((x) => x.id === id)!;
    m.close();
    shell.style.display = "none";
    startBattle(save, levelChapter(lv), (r) => {
      const cleared = r.won ? DAILY_STAGES : Math.max(0, r.stage - 1);
      const got = finishDaily(save, id, lv, cleared, todayStr());
      track(save, "stages", cleared); addBestiary(save, r.killsBy); track(save, "kills", r.kills);
      writeSave(save);
      shell.style.display = "";
      rerender();
      if (got) toast(`${def.name} Lv${lv}: ${rewardText(got) || "なにも もらえなかった"}`);
    }, { stages: DAILY_STAGES, title: `${def.name} Lv${lv}` });
  };
  draw();
  const m = overlay(body, "", () => { m.close(); rerender(); });
}
