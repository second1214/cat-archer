// 装備メニューの「ルーン」タブ: 種類ごとの枠・持っているルーン・ルーンの窓（付ける・はずす・合成）。
import { equipRune, mergeAllRunes, mergeRune, runeEquipped, runePartners, unequipRune } from "../core/run";
import { GRADE_NAMES, RUNE_MAP, RUNE_SLOTS, RUNE_TYPE_NAMES, RUNE_TYPES, RUNE_UNLOCK_CHAPTER, runeBase, type Rune } from "../core/runes";
import { etchedSlotsOpen, writeSave, type SaveData } from "../core/save";
import { fmt, h, overlay, toast } from "./dom";
import { sfx } from "./sfx";

/** 品質の色（コモン〜ミシック） */
const gradeClass = (g: number) => (g >= 10 ? "g-myth" : g >= 6 ? "g-leg" : g >= 3 ? "g-epic" : g >= 2 ? "g-rare" : g >= 1 ? "g-great" : "g-common");
const plus = (g: number) => (["", "", "", "", "+1", "+2", "", "+1", "+2", "+3", ""][g]);

export function runeCard(r: Rune, opts: { equipped?: boolean; merge?: boolean; onclick?: () => void } = {}): HTMLElement {
  const d = RUNE_MAP[r.id];
  return h("button", { class: `rcard ${gradeClass(r.g)}`, onclick: opts.onclick },
    h("div", { class: "rcard-ico" }, d.icon),
    plus(r.g) ? h("div", { class: "rcard-plus" }, plus(r.g)) : null,
    opts.equipped ? h("div", { class: "icard-eq" }, "装備中") : null,
    opts.merge ? h("div", { class: "icard-mg" }, "合成") : null);
}

export function renderRunes(save: SaveData, rerender: () => void): HTMLElement {
  if (save.unlocked < RUNE_UNLOCK_CHAPTER) {
    return h("div", { class: "rn-lock" }, h("div", { class: "rn-lock-ico" }, "🔒"), h("b", null, `ルーンは 第${RUNE_UNLOCK_CHAPTER}章で 解放`),
      h("p", { class: "muted small" }, "ずっと付けておける 強化装備。助っ人ねこの 戦い方を かえられる"));
  }
  const eq = runeEquipped(save);
  const openEtched = etchedSlotsOpen(save);
  const rows = RUNE_TYPES.map((t) => h("div", { class: "rn-row" },
    h("div", { class: "rn-row-n" }, RUNE_TYPE_NAMES[t]),
    h("div", { class: "rn-slots" }, save.runeSlots[t].map((uid, i) => {
      const r = save.runes.find((x) => x.uid === uid);
      if (t === "etched" && i >= openEtched) return h("div", { class: "rcard locked", title: "ほかのルーンを 育てると 開く" }, "🔒");
      return r ? runeCard(r, { onclick: () => openRune(save, r.uid, rerender) }) : h("div", { class: "rcard empty" }, "＋");
    }))));
  const sorted = [...save.runes].sort((a, b) =>
    RUNE_TYPES.indexOf(RUNE_MAP[a.id].type) - RUNE_TYPES.indexOf(RUNE_MAP[b.id].type) || b.g - a.g || a.id.localeCompare(b.id));
  const canMerge = save.runes.some((x) => runePartners(save, x));
  return h("div", { class: "rn" },
    rows,
    h("p", { class: "muted small" }, "銘刻の枠: 付けている 祝福・能力・強化が ぜんぶ エピック以上で1つ、レジェンドで2つ、レジェンド+2で3つ 開く"),
    h("div", { class: "eq-head" },
      h("span", null, `ルーン ${save.runes.length}`),
      h("button", { class: `btn btn-small ${canMerge ? "btn-gold" : "btn-gray"}`, disabled: !canMerge, onclick: () => {
        const made = mergeAllRunes(save);
        if (made.length) { writeSave(save); sfx("levelup"); toast(`${made.length}回 合成しました`); rerender(); }
      } }, "まとめて合成")),
    save.runes.length
      ? h("div", { class: "eq-grid" }, sorted.map((r) => runeCard(r, { equipped: eq.has(r.uid), merge: !!runePartners(save, r), onclick: () => openRune(save, r.uid, rerender) })))
      : h("p", { class: "muted small" }, "5章からの ボスや 宝箱で 手に入る"),
    h("p", { class: "muted small" }, "同じルーン・同じ品質を 2つ合わせると、品質が1段上がります（コモン → グレート → レア → エピック → … → ミシック）。"));
}

function openRune(save: SaveData, uid: number, rerender: () => void): void {
  const r = save.runes.find((x) => x.uid === uid);
  if (!r) return;
  const d = RUNE_MAP[r.id];
  const isEq = runeEquipped(save).has(uid);
  const mates = runePartners(save, r);
  const b = runeBase(r);
  const m = overlay(h("div", { class: "item" },
    h("div", { class: `item-head rn-head ${gradeClass(r.g)}` },
      h("div", { class: "item-ico" }, d.icon),
      h("div", null,
        h("div", { class: "item-n" }, d.name),
        h("div", { class: "item-r" }, `${GRADE_NAMES[r.g]}・${RUNE_TYPE_NAMES[d.type]}ルーン`))),
    h("div", { class: "item-st" },
      b.atk ? h("div", { class: "st-line" }, h("span", null, "攻撃力"), h("b", null, `+${fmt(b.atk)}`)) : null,
      b.hp ? h("div", { class: "st-line" }, h("span", null, "最大体力"), h("b", null, `+${fmt(b.hp)}`)) : null),
    h("div", { class: "item-tr" }, d.steps.map((s) => h("div", { class: `tr ${r.g >= s.at ? "on" : ""}` },
      h("span", { class: "tr-at" }, GRADE_NAMES[s.at]), s.desc))),
    h("div", { class: "item-btns two" },
      h("button", { class: "btn", onclick: () => {
        if (isEq) unequipRune(save, uid);
        else if (!equipRune(save, uid)) { toast(d.type === "etched" ? "銘刻の枠が 開いていません" : `${RUNE_TYPE_NAMES[d.type]}の枠が いっぱい（${RUNE_SLOTS[d.type]}つまで）`); return; }
        writeSave(save); sfx("tap"); m.close(); rerender();
      } }, isEq ? "はずす" : "付ける"),
      h("button", { class: `btn ${mates ? "btn-pink" : "btn-gray"}`, disabled: !mates, onclick: () => {
        if (mergeRune(save, uid)) { writeSave(save); sfx("levelup"); toast(`${d.name}が ${GRADE_NAMES[r.g]}になった！`); m.close(); rerender(); openRune(save, uid, rerender); }
      } }, mates ? "合成" : h("span", null, "合成 ", h("small", null, r.g >= 10 ? "最大" : "あと1つ")))),
    h("button", { class: "btn btn-gray btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}
