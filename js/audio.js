/**
 * BEAMFORGE procedural powertrain audio.
 * Everything is synthesised at runtime: no samples, no downloads, and every
 * slider changes the actual signal chain.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeNoiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.3 + white * 0.7;
    data[i] = last;
  }
  return buffer;
}

function makeDistortion(ctx, amount) {
  const shaper = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  const k = 2 + amount * 12;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.volume = 0.72;
    this.profile = {
      pitch: 50, rumble: 62, rasp: 44, turbo: 70, pops: 55,
      exhaust: 'race', cylinders: 8, electric: false
    };
    this.rpm = 850;
    this.throttle = 0;
    this.boost = 0;
    this.lastThrottle = 0;
    this.lastPop = 0;
  }

  async init(profile) {
    if (profile) this.setProfile(profile, false);
    if (this.ready) {
      await this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0.0001;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.ratio.value = 5;
      this.comp.attack.value = 0.008;
      this.comp.release.value = 0.24;
      this.master.connect(this.comp).connect(ctx.destination);

      this.engineBus = ctx.createGain();
      this.engineBus.gain.value = 0.6;
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1800;
      this.filter.Q.value = 0.9;
      this.shaper = makeDistortion(ctx, 0.4);
      this.engineBus.connect(this.shaper).connect(this.filter).connect(this.master);

      this.oscA = ctx.createOscillator();
      this.oscB = ctx.createOscillator();
      this.oscC = ctx.createOscillator();
      this.oscSub = ctx.createOscillator();
      this.oscA.type = 'sawtooth';
      this.oscB.type = 'square';
      this.oscC.type = 'triangle';
      this.oscSub.type = 'sine';
      this.oscA.frequency.value = 55;
      this.oscB.frequency.value = 27.5;
      this.oscC.frequency.value = 83;
      this.oscSub.frequency.value = 27.5;

      this.gainA = ctx.createGain();
      this.gainB = ctx.createGain();
      this.gainC = ctx.createGain();
      this.gainSub = ctx.createGain();
      this.gainA.gain.value = 0.16;
      this.gainB.gain.value = 0.08;
      this.gainC.gain.value = 0.05;
      this.gainSub.gain.value = 0.22;
      this.oscA.connect(this.gainA).connect(this.engineBus);
      this.oscB.connect(this.gainB).connect(this.engineBus);
      this.oscC.connect(this.gainC).connect(this.engineBus);
      this.oscSub.connect(this.gainSub).connect(this.engineBus);
      [this.oscA, this.oscB, this.oscC, this.oscSub].forEach(o => o.start());

      // Textured intake / exhaust noise.
      this.noiseBuffer = makeNoiseBuffer(ctx);
      this.noise = ctx.createBufferSource();
      this.noise.buffer = this.noiseBuffer;
      this.noise.loop = true;
      this.noiseFilter = ctx.createBiquadFilter();
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.value = 900;
      this.noiseFilter.Q.value = 0.7;
      this.noiseGain = ctx.createGain();
      this.noiseGain.gain.value = 0.02;
      this.noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.master);
      this.noise.start();

      // Turbo whistle: a sine + narrow filtered air.
      this.turboOsc = ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 2600;
      this.turboGain = ctx.createGain();
      this.turboGain.gain.value = 0.0001;
      this.turboOsc.connect(this.turboGain).connect(this.master);
      this.turboOsc.start();

      this.turboNoise = ctx.createBufferSource();
      this.turboNoise.buffer = this.noiseBuffer;
      this.turboNoise.loop = true;
      this.turboNoiseFilter = ctx.createBiquadFilter();
      this.turboNoiseFilter.type = 'highpass';
      this.turboNoiseFilter.frequency.value = 3200;
      this.turboNoiseGain = ctx.createGain();
      this.turboNoiseGain.gain.value = 0.0001;
      this.turboNoise.connect(this.turboNoiseFilter).connect(this.turboNoiseGain).connect(this.master);
      this.turboNoise.start();

      this.ready = true;
      await ctx.resume();
      this.master.gain.exponentialRampToValueAtTime(this.targetGain(), ctx.currentTime + 0.6);
      this.setProfile(this.profile, true);
    } catch (err) {
      console.warn('Powertrain audio unavailable', err);
    }
  }

  setProfile(profile, live = true) {
    this.profile = { ...this.profile, ...profile };
    if (!this.ready) return;
    const p = this.profile;
    const t = this.ctx.currentTime;
    if (p.electric) {
      this.oscA.type = 'sine';
      this.oscB.type = 'triangle';
      this.oscC.type = 'sine';
    } else {
      this.oscA.type = 'sawtooth';
      this.oscB.type = p.cylinders <= 4 ? 'square' : 'sawtooth';
      this.oscC.type = 'triangle';
    }
    this.shaper.curve = makeDistortion(this.ctx, p.rasp / 100).curve;
    this.noiseFilter.frequency.setTargetAtTime(600 + p.rasp * 22, t, 0.05);
    this.filter.Q.setTargetAtTime(0.5 + p.rasp / 70, t, 0.05);
    this.turboOsc.frequency.setTargetAtTime(1200 + p.turbo * 42, t, 0.1);
    if (live) this.master.gain.setTargetAtTime(this.targetGain(), t, 0.1);
  }

  targetGain() {
    return this.muted ? 0.0001 : Math.max(0.0001, 0.34 * this.volume);
  }

  setVolume(volume) {
    this.volume = Math.min(1, Math.max(0, volume / 100));
    if (this.ready) this.master.gain.setTargetAtTime(this.targetGain(), this.ctx.currentTime, 0.08);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ready) this.master.gain.setTargetAtTime(this.targetGain(), this.ctx.currentTime, 0.08);
  }

  update({ rpm, throttle, boost, speed, gear, handbrake = false, limiter = false }) {
    if (!this.ready) return;
    if (!Number.isFinite(rpm)) return;
    const p = this.profile;
    const t = this.ctx.currentTime;
    const cyl = p.electric ? 3 : p.cylinders;
    const fire = Math.max(18, (rpm / 60) * (cyl / 2));
    const pitchScale = 0.65 + p.pitch / 140;

    this.oscA.frequency.setTargetAtTime(fire * pitchScale, t, 0.028);
    this.oscB.frequency.setTargetAtTime(fire * 0.5 * pitchScale, t, 0.032);
    this.oscC.frequency.setTargetAtTime(fire * 1.5 * pitchScale, t, 0.026);
    this.oscSub.frequency.setTargetAtTime(fire * 0.25, t, 0.04);

    const load = p.electric ? 0.08 : 0.18 + throttle * 0.2;
    this.gainA.gain.setTargetAtTime(load * (0.7 + p.rasp / 180), t, 0.04);
    this.gainB.gain.setTargetAtTime(load * 0.45, t, 0.04);
    this.gainC.gain.setTargetAtTime(load * (0.22 + p.rasp / 220), t, 0.035);
    this.gainSub.gain.setTargetAtTime(0.1 + (p.rumble / 100) * 0.34 * (0.4 + throttle), t, 0.06);

    this.filter.frequency.setTargetAtTime(420 + rpm * 0.28 + throttle * 2600, t, 0.05);
    this.noiseFilter.frequency.setTargetAtTime(700 + rpm * 0.2 + throttle * 900, t, 0.05);
    this.noiseGain.gain.setTargetAtTime((0.008 + throttle * 0.055) * (p.rasp / 60), t, 0.05);

    const turboLoad = clamp(boost / 45, 0, 1.4) * clamp(throttle, 0, 1.2);
    this.turboGain.gain.setTargetAtTime(0.0001 + turboLoad * (p.turbo / 100) * 0.045, t, 0.08);
    this.turboNoiseGain.gain.setTargetAtTime(0.0001 + turboLoad * (p.turbo / 100) * 0.018, t, 0.1);

    // Overrun crackle and turbo flutter when lifting at load.
    if (this.lastThrottle > 0.55 && throttle < 0.15 && rpm > 3200 && t - this.lastPop > 0.22) {
      if (Math.random() < 0.75) this.pop(0.5 + p.pops / 100);
      if (turboLoad > 0.2) this.blowoff(p.turbo / 100);
      this.lastPop = t;
    }
    if (limiter && t - this.lastPop > 0.16) {
      this.pop(0.38);
      this.lastPop = t;
    }
    this.lastThrottle = throttle;
    this.rpm = rpm;
    this.throttle = throttle;
    this.boost = boost;
  }

  pop(strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 260 + Math.random() * 700;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    const amp = 0.06 + strength * 0.13;
    gain.gain.setValueAtTime(amp, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08 + Math.random() * 0.08);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.2);
  }

  blowoff(strength = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2300, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + 0.38);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.055 * strength, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.45);
  }

  crash(severity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14 * severity, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.7);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.45);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.22 * severity, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
    osc.connect(og).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  shift(up = true) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.engineBus.gain.cancelScheduledValues(t);
    this.engineBus.gain.setTargetAtTime(0.08, t, 0.012);
    this.engineBus.gain.setTargetAtTime(0.6, t + 0.055, 0.04);
    if (up) this.pop(0.3);
  }

  rev(duration = 1.2) {
    if (!this.ready || !this.ctx) return;
    const t = this.ctx.currentTime;
    const target = 7200;
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const f = 1200 + (target - 1200) * Math.pow(i / steps, 0.55);
      const at = t + (i / steps) * duration * 0.7;
      const gain = i === 0 ? 0.2 : 0.15;
      if (i === 0) this.master.gain.setTargetAtTime(0.24, at, 0.02);
    }
    // The main update loop follows rpm; this short synthetic flourish is audible
    // even when the garage car is stationary.
    this.engineBus.gain.setValueAtTime(0.6, t);
    this.engineBus.gain.linearRampToValueAtTime(0.95, t + duration * 0.5);
    this.engineBus.gain.linearRampToValueAtTime(0.6, t + duration);
    this.pop(0.8);
    setTimeout(() => this.pop(0.55), 240);
  }
}
