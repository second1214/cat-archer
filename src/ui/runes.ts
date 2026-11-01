// 装備メニューの「ルーン」タブ: 種類ごとの枠・持っているルーン・ルーンの窓（付ける・はずす・合成）。
import { dismantleRune, equipRune, mergeAllRunes, mergeRune, rollRuneEnchant, runeEquipped, runePartners, setRuneEnchant, unequipRune } from "../core/run";
import { mulberry32 } from "../core/rng";
import { ENCHANT_COST, ENCHANT_Q_NAMES, enchantDesc, enchantSlots, FAMILY_NAMES, G, GRADE_NAMES, type Enchant, RUNE_MAP, RUNE_SLOTS, RUNE_TYPE_NAMES, RUNE_TYPES, RUNE_UNLOCK_CHAPTER, runeBase, type Rune } from "../core/runes";
import { etchedSlotsOpen, writeSave, type SaveData } from "../core/save";
import { fmt, h, helpBtn, overlay, toast } from "./dom";
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
    opts.merge ? h("div", { class: "icard-mg" }, "合成") : null,
    r.en?.some(Boolean) ? h("div", { class: "rcard-en" }, "✦") : null);
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
  const canMerge = save.runes.some((x) => runePartners(save, x, false));
  const junk = save.runes.filter((x) => x.g <= G.great && !eq.has(x.uid) && !x.en?.some(Boolean));
  return h("div", { class: "rn" },
    rows,
    null,
    h("div", { class: "rn-res" },
      h("span", null, "🪨 爪とぎ石 ", h("b", null, fmt(save.stones))),
      h("span", { class: "muted small" }, "ルーン素材: ", GRADE_NAMES.map((n, g) => save.runeMats[g] ? `${n} ${save.runeMats[g]}` : "").filter(Boolean).join("・") || "なし")),
    h("div", { class: "eq-head" },
      h("span", null, `ルーン ${save.runes.length} `, helpBtn("ルーン", "銘刻の枠: 付けている 祝福・能力・強化が ぜんぶ エピック以上で1つ、レジェンドで2つ、レジェンド+2で3つ 開く", "同じルーン・同じ品質を 2つ合わせると、品質が1段上がります（コモン → … → ミシック）。相手がいなければ 同じ品質の ルーン素材（ルーンを分解して得る）を使えます。", `付与: エピック+2で 1つめ、ミシックで 2つめの枠が開く。爪とぎ石 ${ENCHANT_COST}個で 付与を引き、今のと 新しいのを 選べる。爪とぎ石は 5章から、5面をこえると・章クリアで もらえる。`)),
      h("button", { class: `btn btn-small ${junk.length ? "btn-pink" : "btn-gray"}`, disabled: !junk.length, onclick: () => {
        const n = junk.filter((x) => dismantleRune(save, x.uid)).length;
        if (n) { writeSave(save); sfx("coin"); toast(`コモン・グレートを ${n}個 分解した`); rerender(); }
      } }, "コモン・グレートを分解"),
      h("button", { class: `btn btn-small ${canMerge ? "btn-gold" : "btn-gray"}`, disabled: !canMerge, onclick: () => {
        const made = mergeAllRunes(save);
        if (made.length) { writeSave(save); sfx("levelup"); toast(`${made.length}回 合成しました`); rerender(); }
      } }, "まとめて合成")),
    save.runes.length
      ? h("div", { class: "eq-grid" }, sorted.map((r) => runeCard(r, { equipped: eq.has(r.uid), merge: !!runePartners(save, r, false), onclick: () => openRune(save, r.uid, rerender) })))
      : h("p", { class: "muted small" }, "5章からの ボスや 宝箱で 手に入る"),
    null,
    null);
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
    h("div", { class: "rn-en" },
      h("div", { class: "rn-en-h" }, h("b", null, "付与"), d.family !== "none" ? h("small", { class: "muted" }, ` 系統: ${FAMILY_NAMES[d.family]}`) : null, h("small", { class: "muted" }, `　🪨${fmt(save.stones)}`)),
      [0, 1].map((slot) => {
        const open = slot < enchantSlots(r.g);
        const cur = r.en?.[slot] ?? null;
        if (!open) return h("div", { class: "rn-en-row off" }, "🔒 ", slot === 0 ? "エピック+2で 開く" : "ミシックで 開く");
        return h("div", { class: "rn-en-row" },
          h("span", { class: cur ? `enq q${cur.q}` : "muted" }, cur ? `[${ENCHANT_Q_NAMES[cur.q]}] ${enchantDesc(r.id, cur)}` : "まだ ない"),
          h("button", { class: `btn btn-small ${save.stones >= ENCHANT_COST ? "btn-gold" : "btn-gray"}`, disabled: save.stones < ENCHANT_COST, onclick: () => {
            const en = rollRuneEnchant(save, uid, slot, mulberry32((Date.now() ^ (save.seed += 13)) & 0x7fffffff));
            if (!en) return;
            writeSave(save); sfx("levelup"); m.close();
            if (!cur) { setRuneEnchant(save, uid, slot, en); writeSave(save); rerender(); openRune(save, uid, rerender); }
            else chooseEnchant(save, uid, slot, cur, en, rerender);
          } }, `🪨${ENCHANT_COST} ${cur ? "付けなおす" : "付ける"}`));
      })),
    h("div", { class: "item-btns two" },
      h("button", { class: "btn", onclick: () => {
        if (isEq) unequipRune(save, uid);
        else if (!equipRune(save, uid)) { toast(d.type === "etched" ? "銘刻の枠が 開いていません" : `${RUNE_TYPE_NAMES[d.type]}の枠が いっぱい（${RUNE_SLOTS[d.type]}つまで）`); return; }
        writeSave(save); sfx("tap"); m.close(); rerender();
      } }, isEq ? "はずす" : "付ける"),
      h("button", { class: `btn ${mates ? "btn-pink" : "btn-gray"}`, disabled: !mates, onclick: () => {
        if (mergeRune(save, uid)) { writeSave(save); sfx("levelup"); toast(`${d.name}が ${GRADE_NAMES[r.g]}になった！`); m.close(); rerender(); openRune(save, uid, rerender); }
      } }, mates ? (mates.mats ? `合成（素材 ${mates.mats}）` : "合成") : h("span", null, "合成 ", h("small", null, r.g >= 10 ? "最大" : "あと1つ")))),
    !isEq && !r.en?.some(Boolean) ? h("button", { class: "btn btn-gray btn-wide", onclick: () => {
      if (dismantleRune(save, uid)) { writeSave(save); sfx("coin"); toast(`${GRADE_NAMES[r.g]}の ルーン素材 +1`); m.close(); rerender(); }
    } }, `分解して ${GRADE_NAMES[r.g]}の ルーン素材に`) : null,
    h("button", { class: "btn btn-gray btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
}

/** 付けなおし: 今の付与と 新しい付与の どちらを 残すか */
function chooseEnchant(save: SaveData, uid: number, slot: number, cur: Enchant, next: Enchant, rerender: () => void): void {
  const r = save.runes.find((x) => x.uid === uid);
  if (!r) return;
  const pick = (en: Enchant) => { setRuneEnchant(save, uid, slot, en); writeSave(save); sfx("tap"); m.close(); rerender(); openRune(save, uid, rerender); };
  const card = (title: string, en: Enchant) => h("button", { class: "rn-en-pick", onclick: () => pick(en) },
    h("small", { class: "muted" }, title), h("b", { class: `enq q${en.q}` }, `[${ENCHANT_Q_NAMES[en.q]}]`), h("div", null, enchantDesc(r.id, en)));
  const m = overlay(h("div", { class: "pick" },
    h("h2", null, "どちらを残す？"),
    h("div", { class: "rn-en-cmp" }, card("今の", cur), card("新しい", next))), "", () => pick(cur));
}
