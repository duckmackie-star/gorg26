// Procedural Studio-Grade Web Audio Menu Theme for Gorgotolisis Boss Fight 26
// 116 BPM Epic Synthwave / Orchestral-Electronic Boss Arena Lobby Anthem (16-bar seamless loop)

const BPM = 116;
const STEPS_PER_BAR = 16;
const TOTAL_BARS = 16;
const TOTAL_STEPS = STEPS_PER_BAR * TOTAL_BARS; // 256 16th-note steps (~33.1s loop)
const STEP_SEC = 60 / BPM / 4;

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

// MIDI note constants
const C2 = 36, D2 = 38, E2 = 40, F2 = 41, G2 = 43, A2 = 45, Bb2 = 46;
const C3 = 48, D3 = 50, E3 = 52, F3 = 53, G3 = 55, A3 = 57, Bb3 = 58;
const C4 = 60, Cs4 = 61, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, Bb4 = 70;
const C5 = 72, Cs5 = 73, D5 = 74, E5 = 76, F5 = 77, G5 = 79, A5 = 81, Bb5 = 82, C6 = 84;

interface BarSpec {
  bassRoot: number;
  padNotes: number[];
  arpNotes: number[];
}

// 16-bar progression in D Minor (Dark Heroic Boss Theme)
const BARS: BarSpec[] = [
  // Bars 1-4: Dark Anticipation
  { bassRoot: D2, padNotes: [D3, A3, E4, F4], arpNotes: [D4, F4, A4, E5] },
  { bassRoot: Bb2 - 12, padNotes: [Bb2, F3, C4, D4], arpNotes: [Bb3, D4, F4, C5] },
  { bassRoot: G2, padNotes: [G3, D4, A4, Bb4], arpNotes: [G4, Bb4, D5, A5] },
  { bassRoot: A2, padNotes: [A3, E4, G4, Cs5], arpNotes: [A4, Cs5, E5, G5] },

  // Bars 5-8: Rising Tension
  { bassRoot: D2, padNotes: [D3, A3, F4, C5], arpNotes: [D4, F4, A4, C5] },
  { bassRoot: F2, padNotes: [F3, C4, A4, E5], arpNotes: [F4, A4, C5, E5] },
  { bassRoot: C2 + 12, padNotes: [C3, G3, D4, E4], arpNotes: [C4, E4, G4, D5] },
  { bassRoot: A2, padNotes: [A3, D4, E4, A4], arpNotes: [A4, D5, E5, A5] },

  // Bars 9-12: Heroic Boss Anthem Chorus
  { bassRoot: Bb2 - 12, padNotes: [Bb2, F3, A3, D4], arpNotes: [Bb3, D4, F4, A4] },
  { bassRoot: C2 + 12, padNotes: [C3, G3, A3, E4], arpNotes: [C4, E4, G4, A4] },
  { bassRoot: D2, padNotes: [D3, A3, E4, F4], arpNotes: [D4, F4, A4, E5] },
  { bassRoot: F2, padNotes: [F3, C4, G4, A4], arpNotes: [F4, A4, C5, G5] },

  // Bars 13-16: Climax & Turnaround
  { bassRoot: G2, padNotes: [G3, D4, A4, Bb4], arpNotes: [G4, Bb4, D5, A5] },
  { bassRoot: A2, padNotes: [A3, E4, G4, Cs5], arpNotes: [A4, Cs5, E5, G5] },
  { bassRoot: Bb2 - 12, padNotes: [Bb2, F3, C4, D4], arpNotes: [Bb3, D4, F4, C5] },
  { bassRoot: A2, padNotes: [A3, E4, G4, Cs5], arpNotes: [A4, Cs5, E5, A5] },
];

// Melodic phrases indexed by bar (16 steps per bar, null = rest, [midi, durationSteps, velocity])
type LeadNote = [number, number, number];
const LEAD_PATTERNS: Record<number, Record<number, LeadNote>> = {
  // Verse A (bars 0..3) - mysterious call
  0: { 0: [A4, 6, 0.7], 6: [F4, 4, 0.65], 10: [E4, 6, 0.65] },
  1: { 0: [D4, 8, 0.7], 10: [F4, 3, 0.65], 13: [G4, 3, 0.7] },
  2: { 0: [A4, 6, 0.75], 6: [Bb4, 4, 0.75], 10: [G4, 6, 0.7] },
  3: { 0: [E4, 10, 0.7], 12: [Cs4, 4, 0.65] },

  // Verse B (bars 4..7) - building energy
  4: { 0: [A4, 4, 0.8], 4: [D5, 4, 0.85], 8: [C5, 4, 0.8], 12: [A4, 4, 0.75] },
  5: { 0: [F5, 6, 0.88], 6: [E5, 4, 0.82], 10: [C5, 6, 0.78] },
  6: { 0: [D5, 6, 0.85], 6: [E5, 4, 0.85], 10: [G5, 6, 0.9] },
  7: { 0: [E5, 10, 0.88], 12: [A4, 2, 0.75], 14: [C5, 2, 0.8] },

  // Chorus (bars 8..11) - soaring heroic anthem
  8: { 0: [D5, 6, 0.95], 6: [F5, 4, 0.95], 10: [Bb5, 6, 1.0] },
  9: { 0: [A5, 4, 0.95], 4: [G5, 4, 0.9], 8: [E5, 4, 0.9], 12: [G5, 4, 0.92] },
  10: { 0: [F5, 6, 0.96], 6: [E5, 4, 0.9], 10: [D5, 4, 0.92], 14: [A4, 2, 0.85] },
  11: { 0: [C5, 6, 0.95], 6: [D5, 4, 0.92], 10: [E5, 6, 0.96] },

  // Climax & Turnaround (bars 12..15)
  12: { 0: [Bb5, 6, 1.0], 6: [A5, 4, 0.95], 10: [G5, 6, 0.92] },
  13: { 0: [A5, 6, 0.98], 6: [G5, 4, 0.92], 10: [E5, 4, 0.9], 14: [Cs5, 2, 0.88] },
  14: { 0: [D5, 6, 0.95], 6: [F5, 4, 0.95], 10: [G5, 3, 0.92], 13: [A5, 3, 0.96] },
  15: { 0: [A5, 8, 1.0], 8: [Cs5 + 12, 4, 0.92], 12: [E5, 4, 0.88] },
};

export class MenuMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private schedulerTimer: number | null = null;
  private currentStep = 0;
  private nextNoteTime = 0;
  private playing = false;
  private muted = false;
  private targetVolume = 0.55;
  private onStateChange?: () => void;

  constructor(onStateChange?: () => void) {
    this.onStateChange = onStateChange;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx || this.ctx.state === 'closed') {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Master compressor to keep the mix punchy and prevent clipping
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;

      const masterGain = ctx.createGain();
      masterGain.gain.value = 0;

      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      this.compressor = compressor;
      this.masterGain = masterGain;

      // Synthesized stereo hall reverb impulse response
      const reverbLen = Math.floor(ctx.sampleRate * 2.2);
      const ir = ctx.createBuffer(2, reverbLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < reverbLen; i++) {
          const decay = Math.pow(1 - i / reverbLen, 2.6);
          const preDelay = i < ctx.sampleRate * 0.018 ? 0 : 1;
          data[i] = (Math.random() * 2 - 1) * decay * preDelay;
        }
      }
      const convolver = ctx.createConvolver();
      convolver.buffer = ir;
      const reverbFilter = ctx.createBiquadFilter();
      reverbFilter.type = 'lowpass';
      reverbFilter.frequency.value = 4200;
      const reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.34;
      reverbSend.connect(convolver);
      convolver.connect(reverbFilter);
      reverbFilter.connect(compressor);
      this.reverbNode = convolver;
      this.reverbSend = reverbSend;

      // Stereo ping-pong dotted-8th delay send
      const delaySend = ctx.createGain();
      delaySend.gain.value = 0.25;
      const delayL = ctx.createDelay(1.0);
      const delayR = ctx.createDelay(1.0);
      delayL.delayTime.value = STEP_SEC * 3; // dotted 8th
      delayR.delayTime.value = STEP_SEC * 4.5;
      const fbL = ctx.createGain();
      const fbR = ctx.createGain();
      fbL.gain.value = 0.34;
      fbR.gain.value = 0.32;
      const delayTone = ctx.createBiquadFilter();
      delayTone.type = 'lowpass';
      delayTone.frequency.value = 3400;
      const panL = ctx.createStereoPanner();
      const panR = ctx.createStereoPanner();
      panL.pan.value = -0.55;
      panR.pan.value = 0.55;

      delaySend.connect(delayTone);
      delayTone.connect(delayL);
      delayL.connect(panL);
      panL.connect(compressor);
      delayL.connect(fbL);
      fbL.connect(delayR);
      delayR.connect(panR);
      panR.connect(compressor);
      delayR.connect(fbR);
      fbR.connect(delayL);
      this.delaySend = delaySend;

      // Reusable white noise buffer for drums & risers
      const nLen = ctx.sampleRate * 1.5;
      const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const nData = nBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) {
        nData[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = nBuf;
    }

    return this.ctx;
  }

  public async start(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Autoplay policy blocked until user gesture
      }
    }

    if (ctx.state !== 'running') {
      this.onStateChange?.();
      return false;
    }

    const now = ctx.currentTime;
    const goalVol = this.muted ? 0 : this.targetVolume;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(goalVol, now + 0.55);

    if (!this.playing) {
      this.playing = true;
      this.nextNoteTime = now + 0.05;
      this.schedulerTimer = window.setInterval(() => this.scheduler(), 25);
    }

    this.onStateChange?.();
    return true;
  }

  public stop(): void {
    if (!this.playing) return;
    this.playing = false;

    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    if (this.ctx && this.masterGain && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.35);
    }

    this.currentStep = 0;
    this.onStateChange?.();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.masterGain && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : this.targetVolume, now + 0.15);
    }
    this.onStateChange?.();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isPlaying(): boolean {
    return this.playing && this.ctx?.state === 'running';
  }

  public isContextBlocked(): boolean {
    return !this.ctx || this.ctx.state !== 'running';
  }

  public dispose(): void {
    this.stop();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch {
        // Ignore close errors
      }
    }
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.reverbSend = null;
    this.delaySend = null;
  }

  private scheduler(): void {
    if (!this.ctx || !this.playing || this.ctx.state !== 'running') return;
    const lookahead = 0.13;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += STEP_SEC;
      this.currentStep = (this.currentStep + 1) % TOTAL_STEPS;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const barIndex = Math.floor(step / STEPS_PER_BAR);
    const stepInBar = step % STEPS_PER_BAR;
    const bar = BARS[barIndex];
    const isChorus = barIndex >= 8;
    const isIntroSparse = barIndex < 2;

    // 1. Lush Brass/String Pad at the start of every bar
    if (stepInBar === 0) {
      this.playPadChord(bar.padNotes, time, STEP_SEC * 16, isChorus ? 0.11 : 0.08);
    }

    // 2. Crash cymbal + sub boom on phrase boundaries (bars 0, 4, 8, 12)
    if (stepInBar === 0 && barIndex % 4 === 0) {
      this.playCrash(time, barIndex === 8 ? 0.24 : 0.16);
    }

    // 3. Atmospheric Riser sweep on bar 7 & bar 15
    if ((barIndex === 7 || barIndex === 15) && stepInBar === 0) {
      this.playRiser(time, STEP_SEC * 15);
    }

    // 4. Driving Synth Bass (8th / 16th syncopated pulse)
    if (stepInBar % 2 === 0) {
      const octaveBoost = stepInBar % 4 === 2 ? 12 : 0;
      const accent = stepInBar % 4 === 0 ? 1.0 : 0.72;
      this.playBass(
        midiToFreq(bar.bassRoot + octaveBoost),
        time,
        STEP_SEC * 1.75,
        (isChorus ? 0.26 : 0.21) * accent
      );
    } else if (isChorus && (stepInBar === 7 || stepInBar === 15)) {
      // Chorus pickup bass note
      this.playBass(midiToFreq(bar.bassRoot + 12), time, STEP_SEC * 0.9, 0.18);
    }

    // 5. Shimmering Stereo Arpeggiator (16th notes)
    const arpPattern = [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 3, 1, 2, 3, 1, 2];
    const arpNote = bar.arpNotes[arpPattern[stepInBar] % bar.arpNotes.length];
    const arpPan = ((stepInBar % 4) - 1.5) * 0.42;
    this.playArp(
      midiToFreq(arpNote + (isChorus && stepInBar % 8 >= 4 ? 12 : 0)),
      time,
      STEP_SEC * 0.95,
      isChorus ? 0.1 : 0.075,
      arpPan
    );

    // 6. Heroic Lead Melody
    const leadNote = LEAD_PATTERNS[barIndex]?.[stepInBar];
    if (leadNote) {
      const [midi, durSteps, vel] = leadNote;
      this.playLead(
        midiToFreq(midi),
        time,
        durSteps * STEP_SEC,
        (isChorus ? 0.21 : 0.16) * vel,
        isChorus
      );
      // Octave sparkle on chorus hits
      if (isChorus && vel >= 0.94) {
        this.playLead(midiToFreq(midi + 12), time, durSteps * STEP_SEC * 0.85, 0.065, true);
      }
    }

    // 7. Electronic Drum Kit
    if (!isIntroSparse || stepInBar % 4 === 0) {
      // Kick on 0, 8 (and driving 4-on-floor or syncopation in chorus)
      if (
        stepInBar === 0 ||
        stepInBar === 8 ||
        (barIndex >= 4 && (stepInBar === 4 || stepInBar === 12)) ||
        (isChorus && (stepInBar === 6 || stepInBar === 14))
      ) {
        this.playKick(time, stepInBar === 0 ? 0.46 : 0.38);
      }
    }

    // Gated Snare on beats 2 & 4 (steps 4 & 12) from bar 2 onward, plus bar 15 fill
    if (barIndex >= 2) {
      if (stepInBar === 4 || stepInBar === 12) {
        this.playSnare(time, isChorus ? 0.26 : 0.2);
      } else if ((barIndex === 7 || barIndex === 15) && stepInBar >= 13) {
        this.playSnare(time, 0.16 + (stepInBar - 12) * 0.04);
      }
    }

    // Crisp Hi-Hat groove
    if (barIndex >= 1) {
      if (stepInBar % 2 === 0) {
        const isOpen = stepInBar === 10 || (isChorus && stepInBar === 6);
        this.playHiHat(time, isOpen ? 0.14 : 0.065, isOpen);
      } else if (isChorus || barIndex >= 4) {
        this.playHiHat(time, 0.032, false);
      }
    }
  }

  private playPadChord(midis: number[], time: number, duration: number, gainLevel: number): void {
    if (!this.ctx || !this.compressor || !this.reverbSend) return;
    const ctx = this.ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(550, time);
    filter.frequency.linearRampToValueAtTime(1900, time + duration * 0.55);
    filter.frequency.linearRampToValueAtTime(850, time + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainLevel, time + 0.32);
    env.gain.setValueAtTime(gainLevel * 0.85, time + duration - 0.35);
    env.gain.linearRampToValueAtTime(0.0001, time + duration);

    filter.connect(env);
    env.connect(this.compressor);
    env.connect(this.reverbSend);

    midis.forEach((midi) => {
      const freq = midiToFreq(midi);
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.setValueAtTime(detune, time);
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + duration + 0.05);
      }
    });
  }

  private playBass(freq: number, time: number, duration: number, gainLevel: number): void {
    if (!this.ctx || !this.compressor) return;
    const ctx = this.ctx;

    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(freq, time);

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(freq, time);
    saw.detune.setValueAtTime(4, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3.8;
    filter.frequency.setValueAtTime(950, time);
    filter.frequency.exponentialRampToValueAtTime(160, time + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainLevel, time + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    sub.connect(env);
    saw.connect(filter);
    filter.connect(env);
    env.connect(this.compressor);

    sub.start(time);
    saw.start(time);
    sub.stop(time + duration + 0.02);
    saw.stop(time + duration + 0.02);
  }

  private playArp(freq: number, time: number, duration: number, gainLevel: number, pan: number): void {
    if (!this.ctx || !this.compressor || !this.delaySend || !this.reverbSend) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(6, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4200, time);
    filter.frequency.exponentialRampToValueAtTime(1200, time + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainLevel, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, time);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(this.compressor);
    panner.connect(this.delaySend);
    panner.connect(this.reverbSend);

    osc.start(time);
    osc2.start(time);
    osc.stop(time + duration + 0.02);
    osc2.stop(time + duration + 0.02);
  }

  private playLead(freq: number, time: number, duration: number, gainLevel: number, bright: boolean): void {
    if (!this.ctx || !this.compressor || !this.delaySend || !this.reverbSend) return;
    const ctx = this.ctx;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(freq * 0.985, time);
    osc1.frequency.exponentialRampToValueAtTime(freq, time + 0.028);
    osc2.frequency.setValueAtTime(freq * 0.985, time);
    osc2.frequency.exponentialRampToValueAtTime(freq, time + 0.028);
    osc2.detune.setValueAtTime(9, time);

    // Subtle expressiveness vibrato
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5.4;
    lfoGain.gain.setValueAtTime(0, time);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.006, time + Math.min(0.25, duration * 0.4));
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(bright ? 4800 : 3200, time);
    filter.frequency.exponentialRampToValueAtTime(bright ? 2200 : 1400, time + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(gainLevel, time + 0.025);
    env.gain.setValueAtTime(gainLevel * 0.8, time + Math.max(0.03, duration - 0.08));
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.04);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(this.compressor);
    env.connect(this.delaySend);
    env.connect(this.reverbSend);

    osc1.start(time);
    osc2.start(time);
    lfo.start(time);
    osc1.stop(time + duration + 0.06);
    osc2.stop(time + duration + 0.06);
    lfo.stop(time + duration + 0.06);
  }

  private playKick(time: number, gainLevel: number): void {
    if (!this.ctx || !this.compressor) return;
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.11);

    const env = ctx.createGain();
    env.gain.setValueAtTime(gainLevel, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);

    osc.connect(env);
    env.connect(this.compressor);

    osc.start(time);
    osc.stop(time + 0.26);
  }

  private playSnare(time: number, gainLevel: number): void {
    if (!this.ctx || !this.compressor || !this.reverbSend || !this.noiseBuffer) return;
    const ctx = this.ctx;

    // Noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1800;
    hp.Q.value = 0.7;

    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(gainLevel, time);
    nEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);

    noise.connect(hp);
    hp.connect(nEnv);
    nEnv.connect(this.compressor);
    nEnv.connect(this.reverbSend);
    noise.start(time);
    noise.stop(time + 0.21);

    // Body punch
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(195, time);
    body.frequency.exponentialRampToValueAtTime(95, time + 0.08);
    const bEnv = ctx.createGain();
    bEnv.gain.setValueAtTime(gainLevel * 0.75, time);
    bEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

    body.connect(bEnv);
    bEnv.connect(this.compressor);
    body.start(time);
    body.stop(time + 0.12);
  }

  private playHiHat(time: number, gainLevel: number, open: boolean): void {
    if (!this.ctx || !this.compressor || !this.noiseBuffer) return;
    const ctx = this.ctx;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7200;

    const env = ctx.createGain();
    const dur = open ? 0.18 : 0.045;
    env.gain.setValueAtTime(gainLevel, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(hp);
    hp.connect(env);
    env.connect(this.compressor);

    src.start(time);
    src.stop(time + dur + 0.01);
  }

  private playCrash(time: number, gainLevel: number): void {
    if (!this.ctx || !this.compressor || !this.reverbSend || !this.noiseBuffer) return;
    const ctx = this.ctx;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'highpass';
    bp.frequency.value = 4400;

    const env = ctx.createGain();
    env.gain.setValueAtTime(gainLevel, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 1.35);

    src.connect(bp);
    bp.connect(env);
    env.connect(this.compressor);
    env.connect(this.reverbSend);

    src.start(time);
    src.stop(time + 1.4);
  }

  private playRiser(time: number, duration: number): void {
    if (!this.ctx || !this.compressor || !this.reverbSend || !this.noiseBuffer) return;
    const ctx = this.ctx;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.5;
    filter.frequency.setValueAtTime(220, time);
    filter.frequency.exponentialRampToValueAtTime(4200, time + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(0.14, time + duration - 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.compressor);
    env.connect(this.reverbSend);

    src.start(time);
    src.stop(time + duration + 0.02);
  }
}
