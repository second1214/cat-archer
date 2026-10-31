// 装備メニューの「宝物」タブ: 願い（ガチャ）・持っている宝物・星上げ・セット。
import { ART_MAP, ART_MAX_STAR, ART_RARITY_NAMES, ART_SETS, ARTIFACTS, artStats, DUP_SHARDS, setLevel, starCost, starUp, wish, WISH_PITY } from "../core/artifacts";
import { mulberry32 } from "../core/rng";
import { writeSave, type SaveData } from "../core/save";
import { fmt, h, overlay, toast } from "./dom";
import { sfx } from "./sfx";

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

export function renderArtifacts(save: SaveData, rerender: () => void): HTMLElement {
  const doWish = (n: 1 | 10) => {
    const res = wish(save, mulberry32((Date.now() ^ (save.seed += 19)) & 0x7fffffff), n);
    if (!res) return;
    writeSave(save);
    sfx(res.some((r) => r.kind === "new" && ART_MAP[r.id].r >= 2) ? "clear" : "levelup");
    const m = overlay(h("div", { class: "result gacha-res" },
      h("h2", null, "願い"),
      h("div", { class: `gc-grid ${n === 1 ? "one" : ""}` }, res.map((r) => {
        const d = ART_MAP[r.id];
        return h("div", { class: "gc-cell" },
          h("div", { class: `art-ico ar${d.r}` }, d.icon),
          h("div", { class: "gc-name" }, d.name),
          h("div", { class: "gc-rar" }, r.kind === "new" ? `NEW ${ART_RARITY_NAMES[d.r]}` : `かけら +${r.shards}`));
      })),
      h("button", { class: "btn btn-gold", onclick: () => { m.close(); rerender(); } }, "OK")), "", () => { m.close(); rerender(); });
  };
  const wbtn = (n: 1 | 10) => h("button", { class: `btn ${save.wishBells >= n ? (n === 10 ? "btn-gold" : "btn-pink") : "btn-gray"} gc-btn`, disabled: save.wishBells < n, onclick: () => doWish(n) },
    h("b", null, n === 10 ? "10回" : "1回"), h("small", null, `🔔 ${n}`));
  return h("div", { class: "art" },
    h("div", { class: "gc-hero art-hero" },
      h("div", { class: "gc-title" }, "宝物に 願う"),
      h("div", { class: "gc-sub" }, "家じゅうから 集めた 宝物。持っているだけで 強くなる"),
      h("div", { class: "gc-churu" }, "🔔 ねがいの鈴 ", h("b", null, fmt(save.wishBells)))),
    h("div", { class: "gc-btns" }, wbtn(1), wbtn(10)),
    h("div", { class: "gc-pity" }, `レジェンド以上まで あと ${WISH_PITY - save.wishPity}回で かならず`),
    h("h3", { class: "art-h" }, "セット"),
    h("div", { class: "art-sets" }, ART_SETS.map((set) => {
      const lv = setLevel(save, set);
      return h("div", { class: `art-set ${lv >= 0 ? "on" : ""}` },
        h("b", null, set.name), " ", h("span", null, set.ids.map((id) => ART_MAP[id].icon).join("")),
        h("div", { class: "small" }, lv >= 0 ? `攻撃力・体力 +${pct(set.pct[lv])}` : `ぜんぶ集めると 攻撃力・体力 +${pct(set.pct[0])}`,
          h("span", { class: "muted" }, `（全部 ★${[3, 6, 9, 12, 15].join("・★")} で 最大 +${pct(set.pct[5])}）`)));
    })),
    h("h3", { class: "art-h" }, "宝物"),
    h("div", { class: "eq-grid" }, [...ARTIFACTS].sort((a, b) => b.r - a.r).map((d) => {
      const o = save.artifacts[d.id];
      const have = !!o && o.star > 0, c = have ? starCost(o.star) : null;
      return h("button", { class: `art-card ar${d.r} ${have ? "" : "off"}`, onclick: () => openArt(save, d.id, rerender) },
        h("div", { class: "art-ico" }, have ? d.icon : "？"),
        have ? h("div", { class: "art-star" }, `★${o.star}`) : null,
        have && c !== null && o.shards >= c ? h("div", { class: "icard-mg" }, "★UP") : null);
    })),
    h("p", { class: "muted small" }, `確率（本家と同じ）: ミシック 0.1%・レジェンド 1%・エピック 9%・レア 18%・エピックのかけら 24%・レアのかけら 47.9%。同じ宝物は かけら${DUP_SHARDS}個に。★n→★n+1 は かけら n個。★1つで 基本の力 +50%（★${ART_MAX_STAR}まで）。ねがいの鈴は キャットタワー・毎日のミッション・実績で。`));
}

function openArt(save: SaveData, id: string, rerender: () => void): void {
  const d = ART_MAP[id], o = save.artifacts[id];
  const have = !!o && o.star > 0;
  const st = artStats(id, have ? o.star : 1), c = have ? starCost(o.star) : null;
  const m = overlay(h("div", { class: "item" },
    h("div", { class: `item-head art-head ar${d.r}` }, h("div", { class: "item-ico" }, d.icon),
      h("div", null, h("div", { class: "item-n" }, d.name), h("div", { class: "item-r" }, `${ART_RARITY_NAMES[d.r]}${have ? `・★${o.star}` : "・まだ 持っていない"}`))),
    h("p", { class: "muted small" }, d.flavor),
    h("div", { class: "item-st" },
      h("div", { class: "st-line" }, h("span", null, "攻撃力"), h("b", null, `+${fmt(Math.round(st.atk))}`)),
      h("div", { class: "st-line" }, h("span", null, "最大体力"), h("b", null, `+${fmt(Math.round(st.hp))}`)),
      d.special ? h("div", { class: "st-line" }, h("span", null, "特別"), h("b", null, d.special.desc)) : null),
    have ? h("button", { class: `btn ${c !== null && o.shards >= c ? "btn-gold" : "btn-gray"} btn-wide`, disabled: c === null || o.shards < c, onclick: () => {
      if (starUp(save, id)) { writeSave(save); sfx("levelup"); toast(`${d.name} ★${o.star}`); m.close(); rerender(); openArt(save, id, rerender); }
    } }, c === null ? "★最大" : `★${o.star + 1}へ（かけら ${o.shards} / ${c}）`) : h("p", { class: "small" }, `かけら ${o?.shards ?? 0}（手に入れると 使える）`),
    h("button", { class: "btn btn-gray btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}
