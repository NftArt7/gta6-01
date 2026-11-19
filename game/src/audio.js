// Sound, synthesized live: no audio files ship with the game. Engine hum,
// police sirens, pickup chimes and crash thuds are all oscillators and
// filtered noise through one WebAudio graph. Everything is guarded — a
// headless browser with no audio device must never break the game.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.muted = false;
    this.engineOn = false;
  }

  // Creates the context on the first user gesture (browsers block audio
  // before one) and builds the always-on nodes.
  ensure() {
    if (this.ctx || typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a triangle whose pitch wobbles between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 780;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.8;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 170;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    } catch (err) {
      this.ctx = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.value = muted ? 0 : 0.5;
    }
  }

  // Called every frame: engine pitch follows speed, siren follows the
  // wanted level. Silent when muted or when no context exists.
  update(speed01, throttle, wantedStars) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const target = throttle > 0 || speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0.015;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 165 + throttle * 22, t, 0.08);
    this.sirenGain.gain.setTargetAtTime(wantedStars > 0 ? 0.045 : 0, t, 0.3);
  }

  blip() {
    this.tone(880, 0.09, 'sine', 0.12);
    setTimeout(() => this.tone(1318, 0.12, 'sine', 0.12), 90);
  }

  pickup() {
    this.tone(660, 0.1, 'sine', 0.14);
    setTimeout(() => this.tone(990, 0.14, 'sine', 0.14), 100);
  }

  sting() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.16), i * 110));
  }

  crash() {
    if (!this.ctx || this.muted) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * 0.18);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
    } catch (err) {
      // Audio is decoration; never let it break the game.
    }
  }

  tone(freq, duration, type, volume) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (err) {
      // Audio is decoration; never let it break the game.
    }
  }
}
