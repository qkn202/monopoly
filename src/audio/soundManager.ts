/**
 * Web Audio API Procedural Sound Engine
 * Zero external mp3/wav files - 100% synthesized in real-time.
 * Crisp, instant, zero-latency, works offline & across all browsers.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.6;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initCtx(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Sound 1: Dice Roll (rattling and bouncing impacts)
   */
  public playDiceRoll(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // 5 micro-impacts simulating rolling dice
    for (let i = 0; i < 6; i++) {
      const delay = i * 0.05 + Math.random() * 0.02;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 + Math.random() * 90, now + delay);
      osc.frequency.exponentialRampToValueAtTime(40, now + delay + 0.04);

      gain.gain.setValueAtTime(this.volume * 0.4 * (1 - i * 0.12), now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.05);
    }
  }

  /**
   * Sound 2: Token Step / Hop (crystal footsteps)
   */
  public playTokenStep(pitchIndex: number = 0): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 480 + (pitchIndex % 8) * 35;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.06);

    gain.gain.setValueAtTime(this.volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Sound 3: Galleons Coin Chime (Passing GO, rent collection)
   */
  public playCoin(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [987.77, 1318.51, 1567.98]; // B5, E6, G6
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(this.volume * 0.35, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.4);
    });
  }

  /**
   * Sound 4: Property Acquisition / House Built (Triumphant magic fanfare)
   */
  public playBuyProperty(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Magical arpeggio: C5 -> G5 -> C6 -> E6
    const notes = [523.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(this.volume * 0.35, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.55);
    });
  }

  /**
   * Sound 5: Spell Card Draw (Charms & Potions mystic tone)
   */
  public playSpellCard(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(this.volume * 0.4, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * Sound 6: Auction Gavel (Authoritative gavel strike)
   */
  public playGavel(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    gain.gain.setValueAtTime(this.volume * 0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Sound 7: Azkaban Jail (Heavy iron door clang)
   */
  public playJail(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(80, now);
    osc1.frequency.exponentialRampToValueAtTime(25, now + 0.35);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(110, now);
    osc2.frequency.exponentialRampToValueAtTime(35, now + 0.35);

    gain.gain.setValueAtTime(this.volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.42);
    osc2.stop(now + 0.42);
  }

  /**
   * Sound 8: Victory Fanfare
   */
  public playVictory(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { f: 523.25, t: 0.0, d: 0.15 },
      { f: 659.25, t: 0.15, d: 0.15 },
      { f: 783.99, t: 0.3, d: 0.2 },
      { f: 1046.5, t: 0.5, d: 0.5 },
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(this.volume * 0.4, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.05);
    });
  }

  /**
   * Sound 9: Rent / Tax Payment (Descending warning chord with dual coin rattle)
   */
  public playPayRent(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Descending tension notes: F#4 -> D4 -> A3
    const baseNotes = [369.99, 293.66, 220.0];
    baseNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + idx * 0.08 + 0.14);

      gain.gain.setValueAtTime(this.volume * 0.22, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.18);
    });

    // Dual sharp metallic coin clinks
    [0.18, 0.26].forEach((timeOffset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400 + idx * 250, now + timeOffset);
      osc.frequency.exponentialRampToValueAtTime(800, now + timeOffset + 0.08);

      gain.gain.setValueAtTime(this.volume * 0.35, now + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.1);
    });
  }

  /**
   * Sound 10: Turn Countdown Tick (Warning clock tick for last 5 seconds)
   */
  public playTick(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);

    gain.gain.setValueAtTime(this.volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Sound 11: Turn Timeout Alert (Magic warning chime when turn auto-expires)
   */
  public playTimeoutAlert(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 392.0]; // C5 -> G4 alert chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(this.volume * 0.35, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.28);
    });
  }

  /**
   * Sound 12: Dark Curse Storm / Voldemort's Rise (Thunder, ominous tritone chime)
   */
  public playDarkCurseStorm(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Deep Sub-bass Thunder Rumble (55Hz -> 30Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(65, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 1.2);
    subGain.gain.setValueAtTime(this.volume * 0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.4);

    // 2. Ominous Dark Lord Tritone Strikes (E2, Bb2, E3)
    const darkChords = [82.4, 116.5, 164.8];
    darkChords.forEach((freq, idx) => {
      const chordOsc = ctx.createOscillator();
      const chordGain = ctx.createGain();
      chordOsc.type = 'triangle';
      chordOsc.frequency.setValueAtTime(freq, now + 0.08 * idx);
      chordGain.gain.setValueAtTime(this.volume * 0.35, now + 0.08 * idx);
      chordGain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      chordOsc.connect(chordGain);
      chordGain.connect(ctx.destination);
      chordOsc.start(now + 0.08 * idx);
      chordOsc.stop(now + 1.6);
    });
  }
}

export const soundManager = new SoundEngine();
