import { canGodforge, CRYSTALS_PER_CHAOS, DESCENT_NAMES, DESCENT_SLOT_DESC, essenceOf, gfAffordable, gfCost, GF_MAX, GF_MIN_RARITY, GF_STEP_DESC, godforge } from "../core/godforge";
import { renderArtifacts } from "./artifacts";
// 装備の画面: 5つの枠・合成素材・持ち物・装備の窓（装備・強化・合成・分解）。ルーンは べつのタブ。
import { activeTraits, allTraits, fodderRarity, ITEM_MAP, MYTHIC, itemStats, MAX_LEVEL, MAX_RARITY, MERGE_COUNT, mergePartners, RARITY_NAMES, SERIES, SERIES_MAP, setBonuses, SLOT_NAMES, SLOTS, upgradeCost, type Item, type Stats } from "../core/equip";
import { dismantleItem, dismantleMany, equipItem, mergeAll, mergeItem, toggleLock, unequipItem, upgradeItem } from "../core/run";
import { RUNE_UNLOCK_CHAPTER } from "../core/runes";
import { equippedItems, equippedSet, loadoutOf, powerOf, writeSave, type SaveData } from "../core/save";
import { fmt, h, overlay, toast } from "./dom";
import { renderRunes } from "./runes";
import { sfx } from "./sfx";

const STAT_LABEL: [keyof Stats, string, boolean][] = [
  ["atk", "攻撃力", false], ["hp", "体力", false], ["hpPct", "体力", true], ["atkPct", "攻撃力", true], ["aspd", "攻撃の速さ", true],
  ["crit", "会心", true], ["dodge", "よける", true], ["guard", "受けるダメージ -", true], ["coinPct", "にぼし", true],
  ["laserPct", "レーザー", true], ["strikePct", "助っ人ねこ", true], ["orbitPct", "まわる玉", true],
];

function statLines(st: Stats): HTMLElement[] {
  return STAT_LABEL.filter(([k]) => Math.abs(st[k]) > 1e-6).map(([k, label, pct]) =>
    h("div", { class: "st-line" }, h("span", null, label), h("b", null, pct ? `${st[k] > 0 && k !== "guard" ? "+" : ""}${Math.round(st[k] * 100)}%` : `+${fmt(st[k])}`)));
}

export function itemCard(it: Item, opts: { equipped?: boolean; merge?: boolean; onclick?: () => void } = {}): HTMLElement {
  const d = ITEM_MAP[it.id];
  return h("button", { class: `icard r${it.r} ${d.series ? "series" : ""}`, onclick: opts.onclick },
    h("div", { class: "icard-ico" }, d.icon),
    h("div", { class: "icard-lv" }, `Lv${it.lv}`),
    d.series ? h("div", { class: "icard-sr" }, SERIES_MAP[d.series].icon) : null,
    it.locked ? h("div", { class: "icard-lock" }, "🔒") : null,
    opts.equipped ? h("div", { class: "icard-eq" }, "装備中") : null,
    opts.merge ? h("div", { class: "icard-mg" }, "合成") : null);
}

let equipTab: "gear" | "runes" | "art" = "gear";
/** まとめて分解: えらんでいる 装備（null なら ふつうの表示） */
let picking: Set<number> | null = null;

export function renderEquip(save: SaveData, rerender: () => void): HTMLElement {
  const tabs = h("div", { class: "eq-tabs" },
    h("button", { class: equipTab === "gear" ? "on" : "", onclick: () => { equipTab = "gear"; sfx("tap"); rerender(); } }, "装備"),
    h("button", { class: equipTab === "runes" ? "on" : "", onclick: () => { equipTab = "runes"; sfx("tap"); rerender(); } }, "ルーン", save.unlocked < RUNE_UNLOCK_CHAPTER ? " 🔒" : ""),
    h("button", { class: equipTab === "art" ? "on" : "", onclick: () => { equipTab = "art"; sfx("tap"); rerender(); } }, "宝物"));
  if (equipTab !== "gear") picking = null;
  if (equipTab === "art") return h("div", { class: "screen equip" }, tabs, renderArtifacts(save, rerender));
  if (equipTab === "runes") return h("div", { class: "screen equip" }, tabs, renderRunes(save, rerender));
  const eq = equippedSet(save);
  const lo = loadoutOf(save);
  const slots = SLOTS.map((s) => {
    const it = save.items.find((x) => x.uid === save.equipped[s]);
    return h("div", { class: "eq-slot" },
      h("div", { class: "eq-slot-n" }, SLOT_NAMES[s]),
      it ? itemCard(it, { onclick: () => openItem(save, it.uid, rerender) }) : h("div", { class: "icard empty" }, "＋"));
  });
  const sets = setBonuses(equippedItems(save));
  const sorted = [...save.items].sort((a, b) =>
    SLOTS.indexOf(ITEM_MAP[a.id].slot) - SLOTS.indexOf(ITEM_MAP[b.id].slot) || b.r - a.r || a.id.localeCompare(b.id) || b.lv - a.lv);
  const canMergeAny = save.items.some((x) => mergePartners(save.items, x, eq));
  return h("div", { class: "screen equip" },
    tabs,
    h("div", { class: "eq-slots five" }, slots),
    sets.length ? h("div", { class: "eq-sets" }, sets.map((b) => h("div", { class: "eq-set" },
      h("b", null, `${b.series.icon} ${b.series.name} ${b.count}/5`),
      h("span", { class: b.count >= 2 ? "on" : "" }, `2つ: ${b.series.set2.desc}`),
      h("span", { class: b.count >= 4 ? "on" : "" }, `4つ: ${b.series.set4.desc}`)))) : null,
    h("div", { class: "eq-sum" },
      h("span", null, "⚔️ 攻撃 ", h("b", null, fmt(lo.atk))),
      h("span", null, "❤️ 体力 ", h("b", null, fmt(lo.hp))),
      h("span", null, "戦力 ", h("b", null, fmt(powerOf(lo))))),
    h("div", { class: "eq-mats" }, h("span", { class: "eq-mats-t" }, "合成素材"),
      RARITY_NAMES.slice(0, MYTHIC).map((n, r) => h("span", { class: `eq-mat r${r}` }, n.slice(0, 2), h("b", null, String(save.materials[r]))))),
    save.essence || save.cores || Object.values(save.crystals).some(Boolean) ? h("div", { class: "eq-mats" }, h("span", { class: "eq-mats-t" }, "神鍛"),
      h("span", { class: "eq-mat" }, "✨", h("b", null, fmt(save.essence))),
      SERIES.map((sr) => h("span", { class: "eq-mat" }, sr.icon, h("b", null, String(save.crystals[sr.id] ?? 0)))),
      h("span", { class: "eq-mat" }, "🔆", h("b", null, String(save.cores)))) : null,
    picking ? pickBar(save, sorted, rerender) : h("div", { class: "eq-head" },
      h("span", null, `持ち物 ${save.items.length}`),
      h("div", { class: "eq-head-btns" },
        h("button", { class: "btn btn-small", onclick: () => { picking = new Set(); sfx("tap"); rerender(); } }, "まとめて分解"),
        h("button", { class: `btn btn-small ${canMergeAny ? "btn-gold" : "btn-gray"}`, disabled: !canMergeAny, onclick: () => {
          const made = mergeAll(save);
          if (made.length) { writeSave(save); sfx("levelup"); toast(`${made.length}回 合成しました`); rerender(); }
        } }, "まとめて合成"))),
    h("div", { class: `eq-grid ${picking ? "picking" : ""}` }, sorted.map((it) => {
      const can = !eq.has(it.uid) && !it.locked;
      const card = itemCard(it, {
        equipped: eq.has(it.uid),
        merge: !picking && !!mergePartners(save.items, it, eq),
        onclick: () => {
          if (!picking) { openItem(save, it.uid, rerender); return; }
          if (!can) { toast(it.locked ? "鍵が かかっています" : "装備中は 分解できません"); return; }
          if (picking.has(it.uid)) picking.delete(it.uid); else picking.add(it.uid);
          sfx("tap"); rerender();
        },
      });
      if (picking) card.classList.add(picking.has(it.uid) ? "picked" : can ? "pickable" : "unpickable");
      return card;
    })),
    h("p", { class: "muted small" }, `同じ装備・同じ品質を ${MERGE_COUNT}つ合わせると、1段上がります（コモン → グレート → レア → エピック → レジェンド → ミシック）。ミシックから上（+1〜+4 → カオス）は、同じ装備の レジェンド 2つで 1段上がります。足りない分は 同じ品質の 合成素材で うめられます。いらない装備は 分解すると 同じ品質の 合成素材になります。`));
}

/** まとめて分解の 操作の帯（えらんだ数・品質ごとに ぜんぶ えらぶ・分解・やめる） */
function pickBar(save: SaveData, sorted: Item[], rerender: () => void): HTMLElement {
  const sel = picking!;
  const eq = equippedSet(save);
  const can = sorted.filter((x) => !eq.has(x.uid) && !x.locked);
  const byR = (r: number) => can.filter((x) => x.r === r);
  return h("div", { class: "pick-bar" },
    h("div", { class: "pick-bar-t" }, `分解する 装備を えらぶ（${sel.size}個）`),
    h("div", { class: "pick-bar-q" }, RARITY_NAMES.map((n, r) => byR(r).length ? h("button", { class: `eq-mat r${r}`, onclick: () => {
      const list = byR(r), all = list.every((x) => sel.has(x.uid));
      for (const x of list) { if (all) sel.delete(x.uid); else sel.add(x.uid); }
      sfx("tap"); rerender();
    } }, `${n.slice(0, 2)}ぜんぶ`) : null)),
    h("div", { class: "pick-bar-btns" },
      h("button", { class: "btn btn-small btn-gray", onclick: () => { picking = null; rerender(); } }, "やめる"),
      h("button", { class: `btn btn-small ${sel.size ? "btn-pink" : "btn-gray"}`, disabled: !sel.size, onclick: () => {
        const n = dismantleMany(save, [...sel]);
        picking = null; writeSave(save); sfx("levelup"); toast(`${n}個 分解して 合成素材に した`); rerender();
      } }, `${sel.size}個 分解`)));
}

function openItem(save: SaveData, uid: number, rerender: () => void): void {
  const it = save.items.find((x) => x.uid === uid);
  if (!it) return;
  const d = ITEM_MAP[it.id];
  const eq = equippedSet(save);
  const isEq = eq.has(uid);
  const cost = upgradeCost(it);
  const p = mergePartners(save.items, it, eq, save.materials);
  const traits = activeTraits(it);
  const sr = d.series ? SERIES_MAP[d.series] : null;
  const fr = fodderRarity(it.r);
  const same = save.items.filter((x) => x.uid !== uid && x.id === it.id && x.r === fr && !eq.has(x.uid) && !x.locked).length;
  const lack = Math.max(0, MERGE_COUNT - 1 - same - save.materials[fr]);
  const close = () => { m.close(); rerender(); };
  const m = overlay(h("div", { class: "item" },
    h("div", { class: `item-head r${it.r}` },
      h("div", { class: "item-ico" }, d.icon),
      h("div", null,
        h("div", { class: "item-n" }, d.name),
        h("div", { class: "item-r" }, `${RARITY_NAMES[it.r]}・${SLOT_NAMES[d.slot]}・Lv ${it.lv} / ${MAX_LEVEL[it.r]}`))),
    h("button", { class: `item-lock ${it.locked ? "on" : ""}`, "aria-label": "鍵", onclick: () => {
      const on = toggleLock(save, uid); writeSave(save); sfx("tap"); toast(on ? "鍵を かけた（合成の材料・分解に 使わない）" : "鍵を はずした"); close(); openItem(save, uid, rerender);
    } }, it.locked ? "🔒" : "🔓"),
    h("div", { class: "item-flavor" }, `「${d.flavor}」`),
    sr ? h("div", { class: "item-series" }, h("b", null, `${sr.icon} ${sr.name}シリーズ`), h("span", null, `${sr.focus}に 特化`),
      h("span", null, `2つ: ${sr.set2.desc}`), h("span", null, `4つ: ${sr.set4.desc}`)) : null,
    h("div", { class: "item-st" }, statLines(itemStats(it))),
    h("div", { class: "item-tr" }, allTraits(it.id).filter((t) => t.at <= Math.max(MYTHIC, it.r + 2)).map((t) => h("div", { class: `tr ${traits.includes(t) ? "on" : ""}` },
      h("span", { class: "tr-at" }, RARITY_NAMES[t.at]), t.desc))),
    sr ? gfBox(save, it, () => { close(); openItem(save, uid, rerender); }) : null,
    h("div", { class: "item-btns" },
      h("button", { class: "btn", onclick: () => {
        if (isEq) unequipItem(save, uid); else equipItem(save, uid);
        writeSave(save); sfx("tap"); close();
      } }, isEq ? "はずす" : "装備する"),
      h("button", { class: `btn ${cost !== null && save.coins >= cost ? "btn-gold" : "btn-gray"}`, disabled: cost === null || save.coins < cost, onclick: () => {
        if (upgradeItem(save, uid)) { writeSave(save); sfx("coin"); close(); openItem(save, uid, rerender); }
      } }, cost === null ? "最大レベル" : h("span", null, "強化 ", h("small", null, `🐟${fmt(cost)}`))),
      h("button", { class: `btn ${p ? "btn-pink" : "btn-gray"}`, disabled: !p, onclick: () => {
        if (mergeItem(save, uid)) { writeSave(save); sfx("levelup"); toast(`${d.name}が ${RARITY_NAMES[it.r]}になった！`); close(); openItem(save, uid, rerender); }
      } }, it.r >= MAX_RARITY ? "最大" : p ? h("span", null, "合成", p.mats ? h("small", null, ` 素材${p.mats}`) : null) : h("span", null, "合成 ", h("small", null, fr !== it.r ? `${RARITY_NAMES[fr]} あと${lack}` : `あと${lack}つ`)))),
    h("div", { class: "item-btns two" },
      h("button", { class: `btn ${isEq || it.locked ? "btn-gray" : ""}`, disabled: isEq || !!it.locked, onclick: () => {
        if (dismantleItem(save, uid)) { writeSave(save); sfx("tap"); toast(`${RARITY_NAMES[it.r]}の 合成素材を 手に入れた`); close(); }
      } }, h("span", null, "分解 ", h("small", null, (it.r >= MYTHIC ? `→ レジェンド素材 ${3 + 2 * (it.r - MYTHIC)}` : `→ ${RARITY_NAMES[it.r]}素材`) + (sr && it.r >= MAX_RARITY ? `・${sr.icon}結晶 ${CRYSTALS_PER_CHAOS}` : `・✨${essenceOf(it.r)}`)))),
      h("button", { class: "btn btn-gray", onclick: () => m.close() }, "とじる"))), "", () => m.close());
}

/** 神鍛（ミシック+3 以上の シリーズ装備） */
function gfBox(save: SaveData, it: Item, reopen: () => void): HTMLElement {
  const d = ITEM_MAP[it.id], sr = SERIES_MAP[d.series!], g = it.gf ?? 0, c = gfCost(it);
  if (it.r < GF_MIN_RARITY) return h("div", { class: "gf-box off" }, h("b", null, "🔆 神鍛"), h("small", { class: "muted" }, ` ${RARITY_NAMES[GF_MIN_RARITY]}から できる`));
  return h("div", { class: "gf-box" },
    h("div", null, h("b", null, `🔆 神鍛 ★${g} / ${GF_MAX}`)),
    GF_STEP_DESC.map((t, i) => h("div", { class: `tr ${g > i ? "on" : ""}` }, h("span", { class: "tr-at" }, `★${i + 1}`),
      i === GF_MAX - 1 ? `降臨「${DESCENT_NAMES[sr.id]}」: ${DESCENT_SLOT_DESC[d.slot]}${d.slot === "weapon" ? "" : "（武器も ★5・同じシリーズのとき）"}` : t)),
    canGodforge(it) && c ? h("button", { class: `btn ${gfAffordable(save, it) ? "btn-gold" : "btn-gray"} btn-wide`, disabled: !gfAffordable(save, it), onclick: () => {
      if (godforge(save, it.uid)) { writeSave(save); sfx("levelup"); toast(`${d.name} 神鍛 ★${it.gf}`); reopen(); }
    } }, `★${g + 1}へ ✨${fmt(save.essence)}/${c.essence}`, c.crystals ? ` ${sr.icon}${save.crystals[sr.id] ?? 0}/${c.crystals}` : "", c.cores ? ` 🔆${save.cores}/${c.cores}` : "") : null);
}
