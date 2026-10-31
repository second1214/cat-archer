// 主人公にえらべる猫（見た目だけ。強さは みんな同じ）。絵は public/cat/<id>/。
export interface CatDef { id: string; name: string }

export const CATS: readonly CatDef[] = [
  { id: "chatora", name: "ノルウェージャン" },
  { id: "kijitora", name: "きじとら" },
  { id: "mike", name: "みけ" },
  { id: "kuro", name: "くろ" },
  { id: "shiro", name: "しろ" },
  { id: "hachiware", name: "はちわれ" },
  { id: "sabatora", name: "さばとら" },
  { id: "komugi", name: "こむぎ" },
  { id: "omochi", name: "おもち" },
  { id: "leo", name: "レオ" },
  { id: "luna", name: "ルナ" },
  { id: "chibi", name: "ちび" },
  { id: "sora", name: "そら" },
  { id: "purin", name: "プリン" },
  { id: "hime", name: "ひめ" },
  { id: "kotetsu", name: "こてつ" },
  { id: "kuma", name: "くま" },
  { id: "taisho", name: "大将" },
  { id: "tama", name: "たま" },
];

export const CAT_IDS = new Set(CATS.map((c) => c.id));
export const catName = (id: string) => CATS.find((c) => c.id === id)?.name ?? "ねこ";
