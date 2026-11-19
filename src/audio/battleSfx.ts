// Procedural Web Audio Battle SFX Engine for Gorgotolisis Boss Fight 26
// Synthesizes punchy, layered combat & UI sound effects with zero external audio dependencies.

type SfxCategory =
  | 'gun'
  | 'parry'
  | 'bossHit'
  | 'playerHit'
  | 'heal'
  | 'dash'
  | 'pulse'
  | 'slam'
  | 'quake'
  | 'lock'
  | 'throw'
  | 'sneeze'
  | 'warning'
  | 'minigun'
  | 'ui';

export class BattleSfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private masterVolume = 0.65;
  private lastPlayed: Partial<Record<SfxCategory, number>> = {};

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx || this.ctx.state === 'closed') {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 16;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.14;

      const masterGain = ctx.createGain();
      masterGain.gain.value = this.muted ? 0 : this.masterVolume;

      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.compressor = compressor;
      this.masterGain = masterGain;

      const nLen = ctx.sampleRate * 1.2;
      const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const data = nBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = nBuf;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private canPlay(category: SfxCategory, minIntervalMs: number): boolean {
    if (this.muted) return false;
    const now = performance.now();
    const prev = this.lastPlayed[category] || 0;
    if (now - prev < minIntervalMs) return false;
    this.lastPlayed[category] = now;
    return true;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : this.masterVolume, now + 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playGunShot(): void {
    if (!this.canPlay('gun', 45)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Laser chirp
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.11);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3600, now);
    filter.frequency.exponentialRampToValueAtTime(750, now + 0.11);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.22, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.13);

    // Transient snap
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.14, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    noise.connect(hp);
    hp.connect(nEnv);
    nEnv.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.05);
  }

  public playParry(combo = 1): void {
    if (!this.canPlay('parry', 55)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Rising pentatonic pitch boost by combo
    const semitoneSteps = [0, 2, 4, 7, 9, 12, 14, 16];
    const idx = Math.min(semitoneSteps.length - 1, Math.max(0, combo - 1));
    const baseFreq = 523.25 * Math.pow(2, semitoneSteps[idx] / 12);

    [1, 1.5].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(baseFreq * mult, now + i * 0.025);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * mult * 1.08, now + 0.18);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, now + i * 0.025);
      env.gain.linearRampToValueAtTime(i === 0 ? 0.24 : 0.16, now + i * 0.025 + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.25 + i * 0.04);

      osc.connect(env);
      env.connect(this.compressor!);
      osc.start(now + i * 0.025);
      osc.stop(now + 0.32);
    });

    // Deflect air whoosh
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.0;
    bp.frequency.setValueAtTime(900, now);
    bp.frequency.exponentialRampToValueAtTime(3400, now + 0.13);
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.16, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    noise.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  public playBossHit(isCrit = false): void {
    if (!this.canPlay('bossHit', 50)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Punchy sub thump
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isCrit ? 190 : 145, now);
    sub.frequency.exponentialRampToValueAtTime(42, now + 0.15);

    const sEnv = ctx.createGain();
    sEnv.gain.setValueAtTime(isCrit ? 0.36 : 0.28, now);
    sEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

    sub.connect(sEnv);
    sEnv.connect(this.compressor);
    sub.start(now);
    sub.stop(now + 0.18);

    // Impact crunch
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(isCrit ? 2200 : 1400, now);
    lp.Q.value = 1.1;

    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(isCrit ? 0.25 : 0.18, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    noise.connect(lp);
    lp.connect(nEnv);
    nEnv.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.11);

    if (isCrit) {
      const ping = ctx.createOscillator();
      ping.type = 'triangle';
      ping.frequency.setValueAtTime(880, now);
      ping.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      const pEnv = ctx.createGain();
      pEnv.gain.setValueAtTime(0.18, now);
      pEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      ping.connect(pEnv);
      pEnv.connect(this.compressor);
      ping.start(now);
      ping.stop(now + 0.24);
    }
  }

  public playPlayerHit(): void {
    if (!this.canPlay('playerHit', 90)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(185, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.22);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 950;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.32, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(lp);
    lp.connect(env);
    env.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.25);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const nLp = ctx.createBiquadFilter();
    nLp.type = 'lowpass';
    nLp.frequency.value = 1100;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.22, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    noise.connect(nLp);
    nLp.connect(nEnv);
    nEnv.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  public playHeal(): void {
    if (!this.canPlay('heal', 110)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor) return;
    const now = ctx.currentTime;

    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const t = now + i * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.16, t + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(env);
      env.connect(this.compressor!);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playDash(): void {
    if (!this.canPlay('dash', 150)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(420, now);
    bp.frequency.exponentialRampToValueAtTime(2800, now + 0.14);

    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.24, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    noise.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.2);

    const zip = ctx.createOscillator();
    zip.type = 'triangle';
    zip.frequency.setValueAtTime(240, now);
    zip.frequency.exponentialRampToValueAtTime(760, now + 0.12);
    const zEnv = ctx.createGain();
    zEnv.gain.setValueAtTime(0.16, now);
    zEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    zip.connect(zEnv);
    zEnv.connect(this.compressor);
    zip.start(now);
    zip.stop(now + 0.15);
  }

  public playPulse(): void {
    if (!this.canPlay('pulse', 200)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    // Sub shockwave drop
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(220, now);
    sub.frequency.exponentialRampToValueAtTime(40, now + 0.38);
    const sEnv = ctx.createGain();
    sEnv.gain.setValueAtTime(0.38, now);
    sEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    sub.connect(sEnv);
    sEnv.connect(this.compressor);
    sub.start(now);
    sub.stop(now + 0.44);

    // Emerald shimmer chord
    [392.0, 523.25, 659.25].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.35);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.13, now);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      osc.connect(env);
      env.connect(this.compressor!);
      osc.start(now);
      osc.stop(now + 0.4);
    });

    // Sweeping air burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(320, now);
    bp.frequency.exponentialRampToValueAtTime(3800, now + 0.3);
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.2, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    noise.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.34);
  }

  public playBossSlam(): void {
    if (!this.canPlay('slam', 220)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(115, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.65);
    const sEnv = ctx.createGain();
    sEnv.gain.setValueAtTime(0.45, now);
    sEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    sub.connect(sEnv);
    sEnv.connect(this.compressor);
    sub.start(now);
    sub.stop(now + 0.72);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, now);
    lp.frequency.exponentialRampToValueAtTime(90, now + 0.6);
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.32, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    noise.connect(lp);
    lp.connect(nEnv);
    nEnv.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.68);
  }

  public playEarthquake(): void {
    if (!this.canPlay('quake', 280)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(380, now);
    lp.frequency.exponentialRampToValueAtTime(85, now + 0.45);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.28, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    noise.connect(lp);
    lp.connect(env);
    env.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.5);
  }

  public playBigMacLock(): void {
    if (!this.canPlay('lock', 120)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor) return;
    const now = ctx.currentTime;

    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.08, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      osc.connect(env);
      env.connect(this.compressor!);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  public playBigMacThrow(): void {
    if (!this.canPlay('throw', 120)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.18, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
    noise.connect(bp);
    bp.connect(env);
    env.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.2);
  }

  public playSneeze(): void {
    if (!this.canPlay('sneeze', 400)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(420, now + 0.28);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.32, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    noise.connect(bp);
    bp.connect(env);
    env.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.32);
  }

  public playWarning(): void {
    if (!this.canPlay('warning', 450)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor) return;
    const now = ctx.currentTime;

    [440, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const t = now + i * 0.08;
      osc.frequency.setValueAtTime(freq, t);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2000;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.11, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
      osc.connect(lp);
      lp.connect(env);
      env.connect(this.compressor!);
      osc.start(t);
      osc.stop(t + 0.085);
    });
  }

  public playUiClick(): void {
    if (!this.canPlay('ui', 40)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.04);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.12, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(env);
    env.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playMinigunShot(): void {
    if (!this.canPlay('minigun', 34)) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.compressor || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240 + Math.random() * 55, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.045);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.085, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(env);
    env.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.055);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1750;
    bp.Q.value = 1.4;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0.075, now);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    noise.connect(bp);
    bp.connect(nEnv);
    nEnv.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.04);
  }

  public dispose(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {
        // Ignore close error
      }
    }
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
  }
}
