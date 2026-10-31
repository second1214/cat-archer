// かんたんな効果音（WebAudio で その場で作る。ファイルなし）。
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem("cat-archer/mute") === "1"; } catch { /* なし */ }

export const isMuted = () => muted;
export function setMuted(v: boolean): void {
  muted = v;
  try { localStorage.setItem("cat-archer/mute", v ? "1" : "0"); } catch { /* なし */ }
  syncBgm();
}

/** 最初のタップで 音を使えるようにする（スマホは さわるまで鳴らせない）。 */
export function unlockAudio(): void {
  startBgm();
  if (ctx) return;
  try { ctx = new AudioContext(); } catch { ctx = null; }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

let lastHit = 0;
export function sfx(kind: string): void {
  if (!ctx || muted) return;
  const now = ctx.currentTime;
  switch (kind) {
    case "hit": if (now - lastHit > 0.05) { lastHit = now; tone(520, 0.05, "square", 0.025, 0.6); } break;
    case "kill": tone(700, 0.09, "triangle", 0.06, 1.6); break;
    case "hurt": tone(220, 0.18, "sawtooth", 0.07, 0.5); break;
    case "levelup": [660, 880, 1100].forEach((f, i) => tone(f, 0.12, "triangle", 0.07, 1, i * 0.07)); break;
    case "clear": [523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.07, 1, i * 0.08)); break;
    case "door": tone(400, 0.15, "sine", 0.06, 1.8); break;
    case "boss": tone(110, 0.5, "sawtooth", 0.06, 0.8); break;
    case "lose": [392, 330, 262].forEach((f, i) => tone(f, 0.22, "triangle", 0.07, 1, i * 0.14)); break;
    case "tap": tone(880, 0.04, "sine", 0.04); break;
    case "coin": tone(1200, 0.08, "square", 0.03, 1.3); break;
  }
}

// ---------------- BGM（CC0 の曲。public/bgm、出どころは public/bgm/CREDITS.txt） ----------------
export type BgmId = "home" | "field" | "tower" | "boss";
const BGM_VOL = 0.32;
let bgmEl: HTMLAudioElement | null = null;
let bgmWant: BgmId | null = null;
let bgmNow: BgmId | null = null;
let bgmReady = false;

/** 流す曲を 決める（同じ曲なら そのまま）。null で 止める */
export function bgm(id: BgmId | null): void {
  bgmWant = id;
  syncBgm();
}

function syncBgm(): void {
  if (typeof Audio === "undefined") return;
  const want = muted ? null : bgmWant;
  if (want === bgmNow) return;
  bgmEl?.pause();
  bgmNow = want;
  if (!want) { bgmEl = null; return; }
  bgmEl = new Audio(`bgm/${want}.mp3`);
  bgmEl.loop = true;
  bgmEl.volume = BGM_VOL;
  // スマホは さわるまで 鳴らせない → unlockAudio で もう一度
  if (bgmReady) bgmEl.play().catch(() => { bgmNow = null; });
}

/** 最初のタップのあと（unlockAudio から） */
function startBgm(): void {
  bgmReady = true;
  bgmNow = null;
  syncBgm();
}
