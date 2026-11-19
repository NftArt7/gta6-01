// Solmar City — synthesized sound. No audio files: every sound is a small
// WebAudio patch (engine hum, two-tone siren, pickup blips, impacts).
// Audio starts only after a user gesture unlocks the context.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let sirenOn = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: square wave alternating between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      const sirenFilter = ctx.createBiquadFilter();
      sirenFilter.type = 'lowpass';
      sirenFilter.frequency.value = 1400;
      sirenOsc.connect(sirenFilter);
      sirenFilter.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.25, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  let sirenPhase = 0;
  return {
    unlock() { ensure(); },
    // speed01: 0..1. Call every frame; silent on foot.
    engine(speed01, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + speed01 * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 150, ctx.currentTime, 0.08);
    },
    siren(on) {
      if (!ctx) return;
      sirenOn = on;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.1);
    },
    // Called every frame while the siren is audible: wails between notes.
    update(dt) {
      if (!ctx || !sirenOn) return;
      sirenPhase += dt * 2.4;
      sirenOsc.frequency.value = sirenPhase % 2 < 1 ? 720 : 960;
    },
    blip() { tone(880, 0.12, 'sine', 0.25, 1320); },
    coin() { tone(1046, 0.09, 'sine', 0.22); setTimeout(() => tone(1568, 0.16, 'sine', 0.22), 80); },
    thud() { tone(120, 0.18, 'triangle', 0.4, 55); },
    crash() { tone(90, 0.35, 'sawtooth', 0.35, 40); },
    chime() {
      tone(523, 0.14, 'sine', 0.25);
      setTimeout(() => tone(659, 0.14, 'sine', 0.25), 120);
      setTimeout(() => tone(784, 0.3, 'sine', 0.28), 240);
    },
    wasted() {
      tone(392, 0.4, 'sawtooth', 0.3, 196);
      setTimeout(() => tone(311, 0.7, 'sawtooth', 0.3, 155), 350);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
  };
}
