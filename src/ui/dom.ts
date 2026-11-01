// 小さな DOM の道具。
type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Record<string, unknown> | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
      else if (k === "class") el.className = String(v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k in el && typeof v !== "string") (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Element, c: Child): void {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) { for (const x of c) append(el, x); return; }
  el.append(c instanceof Node ? c : String(c));
}

export const fmt = (n: number) => Math.round(n).toLocaleString("ja-JP");

/** 画面の上に重ねる窓。close() で消える。onBackdrop を わたすと 右上の ✕・背景タップ・Escape でも 閉じる */
const stack: { close(): void; back?: () => void }[] = [];
export function overlay(content: HTMLElement, cls = "", onBackdrop?: () => void): { el: HTMLElement; close(): void } {
  const box = h("div", { class: "ov-box" }, content);
  if (onBackdrop) box.prepend(h("button", { class: "ov-x", "aria-label": "とじる", onclick: () => onBackdrop() }, "✕"));
  const el = h("div", { class: `ov ${cls}` }, box);
  if (onBackdrop) el.addEventListener("click", (e) => { if (e.target === el) onBackdrop(); });
  document.body.append(el);
  const me = { el, close: () => { el.remove(); const k = stack.indexOf(me); if (k >= 0) stack.splice(k, 1); }, back: onBackdrop };
  stack.push(me);
  return me;
}
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const top = stack[stack.length - 1];
  top?.back?.();
});

/** 確認の窓（壊す操作の前に） */
export function confirmBox(title: string, text: string, okLabel: string, onOk: () => void): void {
  const m = overlay(h("div", { class: "pick" },
    h("h2", null, title),
    h("p", { class: "help-p" }, text),
    h("button", { class: "btn btn-wide danger", onclick: () => { m.close(); onOk(); } }, okLabel),
    h("button", { class: "btn btn-ghost btn-wide", onclick: () => m.close() }, "やめる")), "", () => m.close());
}

/** トースト: 順番に 出す。長い文は 長く 出す */
const toastQ: string[] = [];
let toasting = false;
export function toast(msg: string): void {
  toastQ.push(msg);
  if (!toasting) nextToast();
}
function nextToast(): void {
  const msg = toastQ.shift();
  document.querySelector(".toast")?.remove();
  if (msg === undefined) { toasting = false; return; }
  toasting = true;
  const el = h("div", { class: "toast" }, msg);
  document.body.append(el);
  window.setTimeout(() => { el.remove(); nextToast(); }, Math.min(4000, 1300 + 55 * msg.length));
}

/** 「？」ボタン: 説明を 窓で出す（画面に 長い文を 置かないため） */
export function helpBtn(title: string, ...lines: string[]): HTMLElement {
  return h("button", { class: "help-btn", "aria-label": `${title}の 説明`, onclick: (e: Event) => {
    e.stopPropagation();
    const m = overlay(h("div", { class: "pick help" },
      h("h2", null, title),
      lines.map((t) => h("p", { class: "help-p" }, t)),
      h("button", { class: "btn btn-ghost btn-wide", onclick: () => m.close() }, "とじる")), "", () => m.close());
  } }, "？");
}
