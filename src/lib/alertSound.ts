/** Lightweight WebAudio alert tones — no external files */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(freq: number, duration: number, gain = 0.08, type: OscillatorType = "sine") {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ac.destination);
  const now = ac.currentTime;
  g.gain.setValueAtTime(gain, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** Near-me warning — urgent double tone */
export function playWarningSound() {
  beep(880, 0.15, 0.1, "square");
  window.setTimeout(() => beep(1175, 0.2, 0.1, "square"), 180);
  try {
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
  } catch {
    // ignore
  }
}

/** Good chase outlook update — softer rising tone */
export function playChaseOutlookSound() {
  beep(523, 0.12, 0.07, "sine");
  window.setTimeout(() => beep(659, 0.14, 0.07, "sine"), 130);
  window.setTimeout(() => beep(784, 0.18, 0.08, "sine"), 280);
  try {
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
  } catch {
    // ignore
  }
}

export function playPing() {
  beep(660, 0.08, 0.05, "sine");
}
