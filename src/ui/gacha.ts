// ガチャ「飼い主のおみやげ」の画面。チュールで回す。シリーズ装備（季節の衣装）は ここだけ。
import { ITEM_MAP, NORMAL_ITEMS, RARITY_NAMES, SERIES, SLOT_GROUP } from "../core/equip";
import { canPull, GACHA10_COST, GACHA_COST, GACHA_PITY, NORMAL_RATES, pullGacha, SERIES_RARITY, SERIES_RATE } from "../core/gacha";
import { mulberry32 } from "../core/rng";
import { OMIKUJI10_COST, OMIKUJI_COST, OMIKUJI_PITY, OMIKUJI_RATES, pullOmikuji, CHURU_BOSS, CHURU_CHAPTER, CHURU_DAILY, CHURU_FIRST_CLEAR, CHURU_PICKUP, CHURU_STAGE } from "../core/run";
import { writeSave, type SaveData } from "../core/save";
import { fmt, h, overlay } from "./dom";
import { itemCard } from "./equip";
import { runeCard } from "./runes";
import { GRADE_NAMES, RUNE_MAP, RUNE_UNLOCK_CHAPTER } from "../core/runes";
import { sfx } from "./sfx";

export function renderGacha(save: SaveData, rerender: () => void): HTMLElement {
  const left = GACHA_PITY - save.gachaPity;
  const pull = (n: 1 | 10) => {
    const res = pullGacha(save, mulberry32((Date.now() ^ (save.seed += 7)) & 0x7fffffff), n);
    if (!res) return;
    writeSave(save);
    sfx(res.some((r) => r.series) ? "clear" : "levelup");
    const m = overlay(h("div", { class: "result gacha-res" },
      h("h2", null, "おみやげ"),
      h("div", { class: `gc-grid ${n === 1 ? "one" : ""}` }, res.map((r) => h("div", { class: `gc-cell ${r.series ? "series" : ""}` },
        itemCard(r.item),
        h("div", { class: "gc-name" }, ITEM_MAP[r.item.id].name),
        h("div", { class: `gc-rar r${r.item.r}` }, RARITY_NAMES[r.item.r])))),
      res.some((r) => r.series) ? h("div", { class: "gc-hit" }, "シリーズの 衣装が出た！") : null,
      h("button", { class: "btn btn-gold", onclick: () => { m.close(); rerender(); } }, "OK")), "", () => { m.close(); rerender(); });
  };
  const btn = (n: 1 | 10) => h("button", { class: `btn ${canPull(save, n) ? (n === 10 ? "btn-gold" : "btn-pink") : "btn-gray"} gc-btn`, disabled: !canPull(save, n), onclick: () => pull(n) },
    h("b", null, n === 10 ? "10回" : "1回"), h("small", null, `🍥 ${n === 10 ? GACHA10_COST : GACHA_COST}`));
  const total = NORMAL_RATES.reduce((s, [, w]) => s + w, 0);
  const omikuji = (n: 1 | 10) => {
    const res = pullOmikuji(save, mulberry32((Date.now() ^ (save.seed += 11)) & 0x7fffffff), n);
    if (!res) return;
    writeSave(save);
    sfx(res.some((r) => r.g >= 3) ? "clear" : "levelup");
    const m = overlay(h("div", { class: "result gacha-res" },
      h("h2", null, "おみくじ"),
      h("div", { class: `gc-grid ${n === 1 ? "one" : ""}` }, res.map((r) => h("div", { class: "gc-cell" },
        runeCard(r), h("div", { class: "gc-name" }, RUNE_MAP[r.id].name), h("div", { class: "gc-rar" }, GRADE_NAMES[r.g])))),
      h("button", { class: "btn btn-gold", onclick: () => { m.close(); rerender(); } }, "OK")), "", () => { m.close(); rerender(); });
  };
  const okOmi = (n: 1 | 10) => save.unlocked >= RUNE_UNLOCK_CHAPTER && save.churu >= (n === 10 ? OMIKUJI10_COST : OMIKUJI_COST);
  const omiBtn = (n: 1 | 10) => h("button", { class: `btn ${okOmi(n) ? (n === 10 ? "btn-gold" : "btn-pink") : "btn-gray"} gc-btn`, disabled: !okOmi(n), onclick: () => omikuji(n) },
    h("b", null, n === 10 ? "10回" : "1回"), h("small", null, `🍥 ${n === 10 ? OMIKUJI10_COST : OMIKUJI_COST}`));
  const oTotal = OMIKUJI_RATES.reduce((s, [, w]) => s + w, 0);
  return h("div", { class: "screen gacha" },
    h("div", { class: "gc-hero" },
      h("div", { class: "gc-title" }, "飼い主のおみやげ"),
      h("div", { class: "gc-sub" }, "がんばって 虫を追いはらった ごほうび…？ なぜか 着せられる"),
      h("div", { class: "gc-churu" }, "🍥 チュール ", h("b", null, fmt(save.churu)))),
    h("div", { class: "gc-btns" }, btn(1), btn(10)),
    h("div", { class: "gc-pity" }, `シリーズ衣装まで あと ${left}回で かならず`),
    h("div", { class: "gc-series" }, SERIES.map((sr) => h("div", { class: "gc-sr" },
      h("div", { class: "gc-sr-h" }, h("span", { class: "gc-sr-ico" }, sr.icon), h("b", null, `${sr.name}シリーズ`), h("span", { class: "gc-sr-f" }, `${sr.focus}に 特化`)),
      h("div", { class: "gc-sr-items" }, Object.values(ITEM_MAP).filter((d) => d.series === sr.id).map((d) => h("span", { title: d.name }, d.icon))),
      h("div", { class: "muted small" }, `2つ: ${sr.set2.desc}　4つ: ${sr.set4.desc}`)))),
    h("div", { class: "gc-hero omi" },
      h("div", { class: "gc-title" }, "神社の おみくじ"),
      h("div", { class: "gc-sub" }, save.unlocked >= RUNE_UNLOCK_CHAPTER ? "ルーンが 出る。お参りする 猫は 少ない" : `第${RUNE_UNLOCK_CHAPTER}章で 解放`)),
    h("div", { class: "gc-btns" }, omiBtn(1), omiBtn(10)),
    h("div", { class: "gc-pity" }, `エピック以上まで あと ${OMIKUJI_PITY - save.runePity}回で かならず`),
    h("div", { class: "gc-rates muted small" },
      h("b", null, "おみくじの 確率"),
      h("div", null, `強化・能力ルーン 90%: ${OMIKUJI_RATES.map(([g, w]) => `${GRADE_NAMES[g]} ${Math.round((w / oTotal) * 1000) / 10}%`).join("・")}`),
      h("div", null, "祝福ルーン 8%・銘刻ルーン 2%（レア以上）")),
    h("div", { class: "gc-rates muted small" },
      h("b", null, "チュールの もらい方"),
      h("div", null, `1日1回 あそぶ +${CHURU_DAILY}・ステージ クリア +${CHURU_STAGE}・床に落ちている チュール +${CHURU_PICKUP}・ボス +${CHURU_BOSS}・章クリア +${CHURU_CHAPTER}・章を はじめてクリア +${CHURU_FIRST_CLEAR}`)),
    h("div", { class: "gc-rates muted small" },
      h("b", null, "出る物と確率"),
      h("div", null, `シリーズ衣装（${RARITY_NAMES[SERIES_RARITY]}・ガチャだけ）: ${Math.round(SERIES_RATE * 100)}%（${GACHA_PITY}回で かならず）`),
      h("div", null, `ふつうの 武器・防具・アクセサリー（${NORMAL_ITEMS.length}種）: ${NORMAL_RATES.map(([r, w]) => `${RARITY_NAMES[r]} ${Math.round((w / total) * (1 - SERIES_RATE) * 1000) / 10}%`).join("・")}`),
      h("div", null, `分類: ${[...new Set(NORMAL_ITEMS.map((d) => SLOT_GROUP[d.slot]))].join("・")}`)));
}
