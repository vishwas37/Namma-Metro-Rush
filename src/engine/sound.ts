import {
  getSpeechPayload,
  selectPreferredSpeechVoice,
  type VoiceOverPhrase,
} from '../core/voiceOver';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private gestureUnlocked = false;
  private muted = false;
  private announcerEnabled = true;
  private musicTimer: number | null = null;
  private musicWanted = false;
  private musicStep = 0;
  private tokenStreak = 0;
  private lastTokenTime = 0;
  private underground = false;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private lastVoiceOverTs = 0;
  private onVoicesChangedBound: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const refresh = () => {
        try {
          this.cachedVoices = window.speechSynthesis.getVoices();
        } catch {
          this.cachedVoices = [];
        }
      };
      this.onVoicesChangedBound = refresh;
      refresh();
      try {
        window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
      } catch {
        // Older mobile browsers may not support addEventListener on speechSynthesis
      }
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopMusicTimer();
      this.cancelSpeech();
    } else if (this.musicWanted && this.gestureUnlocked) {
      this.ensureMusicLoop();
    }
  }

  public setAnnouncerEnabled(enabled: boolean): void {
    this.announcerEnabled = enabled;
    if (!enabled) this.cancelSpeech();
  }

  public setUnderground(underground: boolean): void {
    this.underground = underground;
  }

  /**
   * Must ONLY be called inside a genuine user gesture (pointerdown, touchstart,
   * keydown, click). Guarantees zero browser AudioContext autoplay warnings!
   */
  public unlockFromGesture(): void {
    if (typeof window === 'undefined') return;
    this.gestureUnlocked = true;
    if (this.muted) return;

    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }
      if (this.musicWanted) {
        this.ensureMusicLoop();
      }
    } catch {
      // Gracefully ignore restricted audio hardware
    }
  }

  public haptic(pattern: number | number[]): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore iOS Safari / restricted vibration APIs
      }
    }
  }

  private getReadyCtx(): AudioContext | null {
    if (this.muted || !this.gestureUnlocked || !this.ctx) return null;
    if (this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  public startMusic(): void {
    this.musicWanted = true;
    if (!this.muted && this.gestureUnlocked) {
      this.ensureMusicLoop();
    }
  }

  public stopMusic(): void {
    this.musicWanted = false;
    this.stopMusicTimer();
  }

  private stopMusicTimer(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private ensureMusicLoop(): void {
    if (this.musicTimer !== null || this.muted || !this.gestureUnlocked) return;
    const bassNotes = [110, 110, 146.83, 130.81, 110, 164.81, 146.83, 130.81];
    const leadChords = [440, 0, 523.25, 0, 587.33, 0, 659.25, 523.25];

    const step = () => {
      const ctx = this.getReadyCtx();
      if (!ctx) return;
      const now = ctx.currentTime;
      const idx = this.musicStep % bassNotes.length;

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassNotes[idx], now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.underground ? 500 : 860, now);
      filter.frequency.exponentialRampToValueAtTime(210, now + 0.17);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.048, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);

      if (this.musicStep % 2 === 1) {
        const hat = ctx.createOscillator();
        const hatGain = ctx.createGain();
        hat.type = 'triangle';
        hat.frequency.setValueAtTime(this.underground ? 2200 : 3000, now);
        hat.frequency.exponentialRampToValueAtTime(800, now + 0.035);
        hatGain.gain.setValueAtTime(0.014, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        hat.connect(hatGain);
        hatGain.connect(ctx.destination);
        hat.start(now);
        hat.stop(now + 0.045);
      }

      const lead = leadChords[idx];
      if (lead > 0 && this.musicStep % 4 === 0) {
        const lOsc = ctx.createOscillator();
        const lGain = ctx.createGain();
        lOsc.type = 'triangle';
        lOsc.frequency.setValueAtTime(lead, now);
        lGain.gain.setValueAtTime(0.001, now);
        lGain.gain.linearRampToValueAtTime(0.022, now + 0.015);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        lOsc.connect(lGain);
        lGain.connect(ctx.destination);
        lOsc.start(now);
        lOsc.stop(now + 0.18);
      }

      this.musicStep++;
    };

    step();
    this.musicTimer = window.setInterval(step, 225);
  }

  public playToken(): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tokenStreak = now - this.lastTokenTime > 0.45 ? 0 : Math.min(11, this.tokenStreak + 1);
    this.lastTokenTime = now;

    // Bright escalating major pentatonic coin combo scale (C5 -> A6)
    const scale = [
      523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0,
      2349.32,
    ];
    const freq = scale[this.tokenStreak] ?? 1046.5;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.15, now + 0.085);
    osc2.frequency.setValueAtTime(freq * 2, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.145);
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.16);
    osc2.stop(now + 0.12);
  }

  public playWhoosh(pitch = 1): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(560 * pitch, now + 0.075);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.068, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playJump(superBoost = false): void {
    this.haptic(superBoost ? 16 : 10);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = superBoost ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(superBoost ? 310 : 260, now);
    osc.frequency.exponentialRampToValueAtTime(superBoost ? 920 : 640, now + (superBoost ? 0.19 : 0.14));
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(superBoost ? 0.12 : 0.1, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (superBoost ? 0.22 : 0.16));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (superBoost ? 0.24 : 0.18));
  }

  public playRoll(): void {
    this.haptic(8);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(118, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.088, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playFastFallThud(): void {
    this.haptic(14);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.11);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playShockwave(): void {
    this.haptic([25, 20, 35]);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.34);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  public playHeadstart(): void {
    this.haptic([18, 16, 26]);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.38);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  public playMysteryBox(): void {
    this.haptic([14, 18, 14, 22]);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.048;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.095, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playChaseStart(): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Metro inspector whistle
    const whistle = ctx.createOscillator();
    const wGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2480, now);
    whistle.frequency.linearRampToValueAtTime(2860, now + 0.14);
    wGain.gain.setValueAtTime(0.001, now);
    wGain.gain.linearRampToValueAtTime(0.065, now + 0.02);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    whistle.connect(wGain);
    wGain.connect(ctx.destination);
    whistle.start(now);
    whistle.stop(now + 0.24);

    // Playful Bengaluru street dog bark
    for (const offset of [0.18, 0.34]) {
      const bark = ctx.createOscillator();
      const bGain = ctx.createGain();
      bark.type = 'triangle';
      bark.frequency.setValueAtTime(420, now + offset);
      bark.frequency.exponentialRampToValueAtTime(190, now + offset + 0.09);
      bGain.gain.setValueAtTime(0.001, now + offset);
      bGain.gain.linearRampToValueAtTime(0.075, now + offset + 0.015);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);
      bark.connect(bGain);
      bGain.connect(ctx.destination);
      bark.start(now + offset);
      bark.stop(now + offset + 0.12);
    }
  }

  public playAutoHorn(): void {
    this.haptic([18, 25, 22]);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const honk = (offset: number, dur: number) => {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      o1.type = 'sawtooth';
      o2.type = 'square';
      o1.frequency.setValueAtTime(466.16, now + offset);
      o2.frequency.setValueAtTime(587.33, now + offset);

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1100, now + offset);
      bp.Q.setValueAtTime(2.2, now + offset);

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.linearRampToValueAtTime(0.1, now + offset + 0.015);
      gain.gain.setValueAtTime(0.095, now + offset + dur - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);

      o1.connect(bp);
      o2.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      o1.start(now + offset);
      o2.start(now + offset);
      o1.stop(now + offset + dur + 0.01);
      o2.stop(now + offset + dur + 0.01);
    };

    honk(0, 0.11);
    honk(0.14, 0.15);
  }

  public playPowerUp(): void {
    this.haptic([14, 20, 14]);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playCloseCall(): void {
    this.haptic(12);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.09);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playStumble(): void {
    this.haptic([24, 30, 24]);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const thud = ctx.createOscillator();
    const tGain = ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(150, now);
    thud.frequency.exponentialRampToValueAtTime(48, now + 0.18);
    tGain.gain.setValueAtTime(0.15, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    thud.connect(tGain);
    tGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.21);

    const whistle = ctx.createOscillator();
    const wGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(2400, now + 0.06);
    whistle.frequency.linearRampToValueAtTime(2750, now + 0.16);
    wGain.gain.setValueAtTime(0.001, now + 0.06);
    wGain.gain.linearRampToValueAtTime(0.055, now + 0.08);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    whistle.connect(wGain);
    wGain.connect(ctx.destination);
    whistle.start(now + 0.06);
    whistle.stop(now + 0.27);
  }

  public playCrash(): void {
    this.haptic([40, 35, 65]);
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.34);
    gain.gain.setValueAtTime(0.17, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  private getSpeechVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    if (this.cachedVoices.length === 0) {
      try {
        this.cachedVoices = window.speechSynthesis.getVoices();
      } catch {
        this.cachedVoices = [];
      }
    }
    return this.cachedVoices;
  }

  private playVoiceCueChime(): void {
    const ctx = this.getReadyCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.055, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  public playVoiceOver(phrase: VoiceOverPhrase): boolean {
    if (this.muted || !this.announcerEnabled) return false;

    this.lastVoiceOverTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.playVoiceCueChime();

    if (
      !this.gestureUnlocked ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return false;
    }

    try {
      const voices = this.getSpeechVoices();
      const matchedVoice = selectPreferredSpeechVoice(voices);
      const payload = getSpeechPayload(phrase, matchedVoice);

      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(payload.text);
      if (matchedVoice) {
        utter.voice = matchedVoice;
      }
      utter.lang = payload.lang;
      utter.rate = phrase.rate;
      utter.pitch = phrase.pitch;
      utter.volume = 0.92;
      window.speechSynthesis.speak(utter);
      return true;
    } catch {
      return false;
    }
  }

  public playStationChime(stationNameEn?: string): void {
    const ctx = this.getReadyCtx();
    if (ctx) {
      const now = ctx.currentTime;
      [783.99, 987.77, 1174.66].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const t = now + i * 0.14;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      });
    }

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const voiceOverRecentlySpoke = nowMs - this.lastVoiceOverTs < 2600;

    if (
      stationNameEn &&
      !voiceOverRecentlySpoke &&
      this.gestureUnlocked &&
      this.announcerEnabled &&
      !this.muted &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    ) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(`Next station, ${stationNameEn}`);
        const voices = this.getSpeechVoices();
        const enVoice =
          voices.find((v) => v.lang.toLowerCase().replace('_', '-') === 'en-in') ??
          voices.find((v) => v.lang.toLowerCase().startsWith('en'));
        if (enVoice) utter.voice = enVoice;
        utter.lang = enVoice?.lang || 'en-IN';
        utter.rate = 1.06;
        utter.pitch = 1.04;
        utter.volume = 0.72;
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore restricted speech synthesis
      }
    }
  }

  public cancelSpeech(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public dispose(): void {
    this.stopMusic();
    this.cancelSpeech();
    if (
      this.onVoicesChangedBound &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      try {
        window.speechSynthesis.removeEventListener?.('voiceschanged', this.onVoicesChangedBound);
      } catch {
        // ignore
      }
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
