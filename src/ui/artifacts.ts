// 装備メニューの「宝物」タブ: 願い（ガチャ）・持っている宝物・星上げ・セット。
import { ART_MAP, ART_MAX_STAR, ART_RARITY_NAMES, ART_SETS, ARTIFACTS, artStats, nextCost, SHARD_PULL, setLevel, starUp, UNLOCK_SHARDS, wish, WISH_PITY } from "../core/artifacts";
import { mulberry32 } from "../core/rng";
import { writeSave, type SaveData } from "../core/save";
import { fmt, h, helpBtn, overlay, toast } from "./dom";
import { sfx } from "./sfx";

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** ショップの「願い」 */
export function wishSection(save: SaveData, rerender: () => void): HTMLElement {
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
  return h("div", { class: "shop-sec" },
    h("div", { class: "gc-hero art-hero" },
      h("div", { class: "gc-title" }, "宝物に 願う ", helpBtn("願い", `確率（本家と同じ）: ミシック 0.1%・レジェンド 1%・エピック 9%・レア 18%・エピックのかけら 24%・レアのかけら 47.9%（かけらは ${SHARD_PULL}個）。`, `同じ宝物が また出たら かけら${UNLOCK_SHARDS}個。${WISH_PITY}回で レジェンド以上 かならず。`, "ねがいの鈴は キャットタワー・毎日のミッション・実績で もらえる。")),
      h("div", { class: "gc-sub" }, "宝物（装備の 宝物タブ）が 出る"),
      h("div", { class: "gc-churu" }, "🔔 ねがいの鈴 ", h("b", null, fmt(save.wishBells)))),
    h("div", { class: "gc-btns" }, wbtn(1), wbtn(10)),
    h("div", { class: "gc-pity" }, `レジェンド以上まで あと ${WISH_PITY - save.wishPity}回で かならず`));
}

export function renderArtifacts(save: SaveData, rerender: () => void): HTMLElement {
  return h("div", { class: "art" },
    h("div", { class: "art-top" }, h("span", null, "🔔 ", h("b", null, fmt(save.wishBells)), " 願いは 🛒ショップで"),
      helpBtn("宝物", `持っているだけで 強くなる。手に入れると ★0、かけら${UNLOCK_SHARDS}個で 解放。★1つで 基本の力 +50%（★${ART_MAX_STAR}まで）。`, "エピック以上は 特別な力。セットは ぜんぶ 持つと 効き、いちばん低い星が ★3・6・9・12・15 で 強くなる。")),
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
      const have = !!o?.owned, c = nextCost(d.id, o);
      return h("button", { class: `art-card ar${d.r} ${have ? "" : "off"}`, onclick: () => openArt(save, d.id, rerender) },
        h("div", { class: "art-ico" }, have ? d.icon : "？"),
        have ? h("div", { class: "art-star" }, `★${o.star}`) : o?.shards ? h("div", { class: "art-star" }, `${o.shards}/${UNLOCK_SHARDS}`) : null,
        c !== null && (o?.shards ?? 0) >= c ? h("div", { class: "icard-mg" }, have ? "★UP" : "解放") : null);
    })));
}

function openArt(save: SaveData, id: string, rerender: () => void): void {
  const d = ART_MAP[id], o = save.artifacts[id];
  const have = !!o?.owned;
  const st = artStats(id, have ? o.star : 0), c = nextCost(id, o);
  const m = overlay(h("div", { class: "item" },
    h("div", { class: `item-head art-head ar${d.r}` }, h("div", { class: "item-ico" }, d.icon),
      h("div", null, h("div", { class: "item-n" }, d.name), h("div", { class: "item-r" }, `${ART_RARITY_NAMES[d.r]}${have ? `・★${o.star}` : "・まだ 持っていない"}`))),
    h("p", { class: "muted small" }, d.flavor),
    h("div", { class: "item-st" },
      h("div", { class: "st-line" }, h("span", null, "攻撃力"), h("b", null, `+${fmt(Math.round(st.atk))}`)),
      h("div", { class: "st-line" }, h("span", null, "最大体力"), h("b", null, `+${fmt(Math.round(st.hp))}`)),
      d.special ? h("div", { class: "st-line" }, h("span", null, "特別"), h("b", null, d.special.desc)) : null),
    h("button", { class: `btn ${c !== null && (o?.shards ?? 0) >= c ? "btn-gold" : "btn-gray"} btn-wide`, disabled: c === null || (o?.shards ?? 0) < c, onclick: () => {
      if (starUp(save, id)) { writeSave(save); sfx("levelup"); toast(`${d.name} ★${save.artifacts[id].star}`); m.close(); rerender(); openArt(save, id, rerender); }
    } }, c === null ? "★最大" : `${have ? `★${o.star + 1}へ` : "解放"}（かけら ${o?.shards ?? 0} / ${c}）`),
    h("button", { class: "btn btn-gray btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}
