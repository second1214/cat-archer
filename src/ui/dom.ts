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

/** 画面の上に重ねる窓。close() で消える。 */
export function overlay(content: HTMLElement, cls = "", onBackdrop?: () => void): { el: HTMLElement; close(): void } {
  const el = h("div", { class: `ov ${cls}` }, h("div", { class: "ov-box" }, content));
  if (onBackdrop) el.addEventListener("click", (e) => { if (e.target === el) onBackdrop(); });
  document.body.append(el);
  return { el, close: () => el.remove() };
}

let toastTimer = 0;
export function toast(msg: string): void {
  document.querySelector(".toast")?.remove();
  const el = h("div", { class: "toast" }, msg);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 1800);
}
