// 装備の画面: 3つの枠・持ち物・装備の窓（装備・強化・合成）。
import { activeTraits, ITEM_MAP, itemStats, MAX_LEVEL, mergePartners, RARITY_NAMES, SLOT_NAMES, SLOTS, upgradeCost, type Item, type Stats } from "../core/equip";
import { mergeAll, mergeItem, equipItem, unequipItem, upgradeItem } from "../core/run";
import { equippedSet, loadoutOf, powerOf, writeSave, type SaveData } from "../core/save";
import { fmt, h, overlay, toast } from "./dom";
import { renderRunes } from "./runes";
import { sfx } from "./sfx";

const STAT_LABEL: [keyof Stats, string, boolean][] = [
  ["atk", "攻撃力", false], ["hp", "体力", false], ["hpPct", "体力", true], ["atkPct", "攻撃力", true], ["aspd", "攻撃の速さ", true],
  ["crit", "会心", true], ["dodge", "よける", true], ["guard", "受けるダメージ -", true], ["coinPct", "にぼし", true],
];

function statLines(st: Stats): HTMLElement[] {
  return STAT_LABEL.filter(([k]) => Math.abs(st[k]) > 1e-6).map(([k, label, pct]) =>
    h("div", { class: "st-line" }, h("span", null, label), h("b", null, pct ? `${st[k] > 0 && k !== "guard" ? "+" : ""}${Math.round(st[k] * 100)}%` : `+${fmt(st[k])}`)));
}

export function itemCard(it: Item, opts: { equipped?: boolean; merge?: boolean; onclick?: () => void } = {}): HTMLElement {
  const d = ITEM_MAP[it.id];
  return h("button", { class: `icard r${it.r}`, onclick: opts.onclick },
    h("div", { class: "icard-ico" }, d.icon),
    h("div", { class: "icard-lv" }, `Lv${it.lv}`),
    opts.equipped ? h("div", { class: "icard-eq" }, "装備中") : null,
    opts.merge ? h("div", { class: "icard-mg" }, "合成") : null);
}

let equipTab: "gear" | "runes" = "gear";

export function renderEquip(save: SaveData, rerender: () => void): HTMLElement {
  const tabs = h("div", { class: "eq-tabs" },
    h("button", { class: equipTab === "gear" ? "on" : "", onclick: () => { equipTab = "gear"; sfx("tap"); rerender(); } }, "装備"),
    h("button", { class: equipTab === "runes" ? "on" : "", onclick: () => { equipTab = "runes"; sfx("tap"); rerender(); } }, "ルーン", save.unlocked < 5 ? " 🔒" : ""));
  if (equipTab === "runes") return h("div", { class: "screen equip" }, tabs, renderRunes(save, rerender));
  const eq = equippedSet(save);
  const lo = loadoutOf(save);
  const slots = SLOTS.map((s) => {
    const it = save.items.find((x) => x.uid === save.equipped[s]);
    return h("div", { class: "eq-slot" },
      h("div", { class: "eq-slot-n" }, SLOT_NAMES[s]),
      it ? itemCard(it, { onclick: () => openItem(save, it.uid, rerender) }) : h("div", { class: "icard empty" }, "＋"));
  });
  const sorted = [...save.items].sort((a, b) =>
    SLOTS.indexOf(ITEM_MAP[a.id].slot) - SLOTS.indexOf(ITEM_MAP[b.id].slot) || b.r - a.r || a.id.localeCompare(b.id) || b.lv - a.lv);
  const canMergeAny = save.items.some((x) => mergePartners(save.items, x, eq));
  return h("div", { class: "screen equip" },
    tabs,
    h("div", { class: "eq-slots" }, slots),
    h("div", { class: "eq-sum" },
      h("span", null, "⚔️ 攻撃 ", h("b", null, fmt(lo.atk))),
      h("span", null, "❤️ 体力 ", h("b", null, fmt(lo.hp))),
      h("span", null, "戦力 ", h("b", null, fmt(powerOf(lo))))),
    h("div", { class: "eq-head" },
      h("span", null, `持ち物 ${save.items.length}`),
      h("button", { class: `btn btn-small ${canMergeAny ? "btn-gold" : "btn-gray"}`, disabled: !canMergeAny, onclick: () => {
        const made = mergeAll(save);
        if (made.length) { writeSave(save); sfx("levelup"); toast(`${made.length}回 合成しました`); rerender(); }
      } }, "まとめて合成")),
    h("div", { class: "eq-grid" }, sorted.map((it) => itemCard(it, {
      equipped: eq.has(it.uid),
      merge: !!mergePartners(save.items, it, eq),
      onclick: () => openItem(save, it.uid, rerender),
    }))),
    h("p", { class: "muted small" }, "同じ装備・同じレア度を 3つ合わせると、1つ上のレア度になります（ふつう → レア → エピック → レジェンド）。"));
}

function openItem(save: SaveData, uid: number, rerender: () => void): void {
  const it = save.items.find((x) => x.uid === uid);
  if (!it) return;
  const d = ITEM_MAP[it.id];
  const eq = equippedSet(save);
  const isEq = eq.has(uid);
  const cost = upgradeCost(it);
  const mates = mergePartners(save.items, it, eq);
  const traits = activeTraits(it);
  const m = overlay(h("div", { class: "item" },
    h("div", { class: `item-head r${it.r}` },
      h("div", { class: "item-ico" }, d.icon),
      h("div", null,
        h("div", { class: "item-n" }, d.name),
        h("div", { class: "item-r" }, `${RARITY_NAMES[it.r]}・${SLOT_NAMES[d.slot]}・Lv ${it.lv} / ${MAX_LEVEL[it.r]}`))),
    h("div", { class: "item-st" }, statLines(itemStats(it))),
    h("div", { class: "item-tr" }, d.traits.map((t) => h("div", { class: `tr ${traits.includes(t) ? "on" : ""}` },
      h("span", { class: "tr-at" }, RARITY_NAMES[t.at]), t.desc))),
    h("div", { class: "item-btns" },
      h("button", { class: "btn", onclick: () => {
        if (isEq) unequipItem(save, uid); else equipItem(save, uid);
        writeSave(save); sfx("tap"); m.close(); rerender();
      } }, isEq ? "はずす" : "装備する"),
      h("button", { class: `btn ${cost !== null && save.coins >= cost ? "btn-gold" : "btn-gray"}`, disabled: cost === null || save.coins < cost, onclick: () => {
        if (upgradeItem(save, uid)) { writeSave(save); sfx("coin"); m.close(); rerender(); openItem(save, uid, rerender); }
      } }, cost === null ? "最大レベル" : h("span", null, "強化 ", h("small", null, `🐟${fmt(cost)}`))),
      h("button", { class: `btn ${mates ? "btn-pink" : "btn-gray"}`, disabled: !mates, onclick: () => {
        if (mergeItem(save, uid)) { writeSave(save); sfx("levelup"); toast(`${d.name}が ${RARITY_NAMES[it.r]}になった！`); m.close(); rerender(); openItem(save, uid, rerender); }
      } }, mates ? "合成" : h("span", null, "合成 ", h("small", null, it.r >= 3 ? "最大" : "あと" + (3 - 1 - save.items.filter((x) => x.uid !== uid && x.id === it.id && x.r === it.r && !eq.has(x.uid)).length) + "つ")))),
    h("button", { class: "btn btn-gray btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}
