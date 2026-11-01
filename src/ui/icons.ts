// 線画の アイコン（自作の SVG。線の太さ・色を そろえて 絵文字の ばらつきを なくす）。
const P: Record<string, string> = {
  shop: '<path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M9.5 12.5c1.2 1.2 3.8 1.2 5 0"/>',
  equip: '<path d="M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M10 4.5V3.5h4v1"/><rect x="9" y="14" width="6" height="4" rx="1"/><path d="M6 13h12"/>',
  adventure: '<ellipse cx="12" cy="16" rx="4.2" ry="3.6"/><circle cx="6.5" cy="10.5" r="1.8"/><circle cx="9.8" cy="6.8" r="1.8"/><circle cx="14.2" cy="6.8" r="1.8"/><circle cx="17.5" cy="10.5" r="1.8"/>',
  challenge: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 4"/><path d="M16 6h2.5a2.5 2.5 0 0 1-2.6 4"/><path d="M12 13v3.5"/><path d="M9 20.5h6l-.8-4h-4.4z"/>',
  train: '<path d="M3.5 10v4"/><path d="M20.5 10v4"/><rect x="5.5" y="7" width="3" height="10" rx="1"/><rect x="15.5" y="7" width="3" height="10" rx="1"/><path d="M8.5 12h7"/>',
  mission: '<rect x="5.5" y="4.5" width="13" height="16.5" rx="1.5"/><path d="M9 3h6v3H9z"/><path d="M9 13l2 2 4-4"/>',
  patrol: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5.5-5.5 1.5 2-5.5z"/><circle cx="12" cy="12" r=".6"/>',
  records: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5z"/><path d="M5 20.5A2.5 2.5 0 0 0 7.5 23H19v-5"/><path d="M9 7.5h6"/>',
  cat: '<path d="M5 20v-9.5L6 4l4 3.5h4L18 4l1 6.5V20z"/><circle cx="9.5" cy="13" r=".9"/><circle cx="14.5" cy="13" r=".9"/><path d="M11 16.2l1 .8 1-.8"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};

export function icon(name: keyof typeof P | string, size = 24): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = P[name] ?? "";
  return svg;
}
