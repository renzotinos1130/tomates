/**
 * TOMATO TOWER — the sounds, made on the spot.
 *
 * No file is loaded: each sound is a few oscillators and a puff of noise,
 * played through the Web Audio API. A browser only lets a page make sound
 * after a gesture (a phone most of all), so the context is created, or woken,
 * the first time the player touches the game; until then, and when the sound
 * is off, every call here does nothing.
 */

const MUTED_KEY = "tthq:tower:muted";
/** A major pentatonic scale: a streak of « parfaits » climbs it. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (semitones: number) => 523.25 * 2 ** (semitones / 12);

/** Whether the member turned the game's sound off, last time. */
export function soundMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export class TowerAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted: boolean;

  constructor() {
    this.muted = soundMuted();
  }

  /** To call from a gesture (a tap, a key): creates the context, or wakes it. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        const buffer = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * 0.3), this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.noise = buffer;
      }
      // « suspended », or « interrupted » on a phone that was just called.
      if (this.ctx.state !== "running") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  /** When the tab goes to the background the game pauses, and so does the sound. */
  suspend() {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  private tone(freq: number, at: number, length: number, type: OscillatorType, volume: number, slideTo?: number) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  private puff(at: number, length: number, volume: number, cutoff: number) {
    if (!this.ctx || !this.master || !this.noise || this.muted) return;
    const t = this.ctx.currentTime + at;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + length + 0.02);
  }

  /** A crate lands: wood on wood. */
  place() {
    this.tone(170, 0, 0.11, "triangle", 0.5, 80);
    this.puff(0, 0.07, 0.35, 1800);
  }

  /** A « parfait »: two bright notes, higher as the streak goes on. */
  perfect(streak: number) {
    const step = SCALE[Math.min(SCALE.length - 2, Math.max(0, streak - 1))];
    this.tone(note(step), 0, 0.12, "square", 0.16);
    this.tone(note(step + 7), 0.07, 0.2, "square", 0.14);
    this.tone(note(step) / 2, 0, 0.14, "triangle", 0.3);
    this.puff(0, 0.05, 0.2, 2600);
  }

  /** The multiplier went up: a quick run of notes. */
  combo(multiplier: number) {
    for (let i = 0; i < Math.min(5, multiplier + 1); i++) this.tone(note(SCALE[i + multiplier - 1] ?? 24), 0.12 + i * 0.055, 0.1, "square", 0.11);
  }

  /** Every ten floors. */
  bonus() {
    [0, 4, 7, 12].forEach((n, i) => this.tone(note(n), i * 0.07, 0.16, "triangle", 0.3));
  }

  /** A new record: a small fanfare. */
  record() {
    [0, 4, 7, 12, 16, 19].forEach((n, i) => this.tone(note(n), i * 0.09, 0.22, "square", 0.14));
    this.tone(note(24), 0.56, 0.5, "triangle", 0.3);
  }

  /** The crate went past the tower. */
  over() {
    [7, 4, 0, -5].forEach((n, i) => this.tone(note(n) / 2, i * 0.13, 0.22, "sawtooth", 0.12));
    this.tone(90, 0.5, 0.4, "triangle", 0.5, 40);
    this.puff(0.5, 0.25, 0.4, 700);
  }

  /** A button of the game. */
  click() {
    this.tone(660, 0, 0.05, "square", 0.08);
  }

  dispose() {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
  }
}
