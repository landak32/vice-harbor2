// Every sound in Vice Harbor is synthesised here with WebAudio: no audio file is ever loaded.
// The city hums with a filtered engine tone that follows the player's car, gunfire is a shaped
// noise burst, sirens are two detuned square waves, and the soundtrack is a small bass-and-
// percussion sequencer whose tempo and brightness climb with the wanted level.

const SCALE = [0, 3, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3];

export class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.effectBus = null;
    this.noise = null;
    this.engine = null;
    this.siren = null;
    this.sirenOn = false;
    this.musicTime = 0;
    this.musicStep = 0;
    this.intensity = 0;
    this.enabled = true;
    this.failed = false;
  }

  /** Browsers only allow audio after a gesture; the first click or key calls this. */
  unlock() {
    if (this.context || this.failed) {
      if (this.context && this.context.state === 'suspended') this.context.resume().catch(() => {});
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        this.failed = true;
        return;
      }
      const context = new Ctor();
      this.context = context;
      this.master = context.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(context.destination);
      this.musicBus = context.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      this.effectBus = context.createGain();
      this.effectBus.gain.value = 0.9;
      this.effectBus.connect(this.master);
      this.noise = this.buildNoiseBuffer();
      this.musicTime = context.currentTime + 0.1;
    } catch {
      this.failed = true;
    }
  }

  buildNoiseBuffer() {
    const context = this.context;
    const buffer = context.createBuffer(1, context.sampleRate * 1.2, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    let seed = 0x1234567;
    for (let i = 0; i < data.length; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      const white = (seed / 2147483648) * 0.5;
      last = last * 0.6 + white * 0.4;
      data[i] = last;
    }
    return buffer;
  }

  get now() {
    return this.context ? this.context.currentTime : 0;
  }

  /** A short shaped tone: the workhorse for blips, horns and impacts. */
  tone({ frequency = 440, endFrequency = 0, duration = 0.15, type = 'sine', gain = 0.2, delay = 0, bus = null }) {
    if (!this.context) return;
    const start = this.now + delay;
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency > 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + Math.min(0.02, duration * 0.3));
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(bus ?? this.effectBus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** A filtered noise burst with a fast decay: gunshots, tyres, crashes, footsteps. */
  burst({ duration = 0.18, gain = 0.3, cutoff = 1600, q = 1.2, sweep = 0, delay = 0 }) {
    if (!this.context || !this.noise) return;
    const start = this.now + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoff, start);
    if (sweep > 0) filter.frequency.exponentialRampToValueAtTime(Math.max(80, sweep), start + duration);
    filter.Q.value = q;
    const amp = this.context.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(amp).connect(this.effectBus);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  gunshot(kind = 'pistol') {
    if (!this.context) return;
    if (kind === 'smg') {
      this.burst({ duration: 0.1, gain: 0.22, cutoff: 2600, q: 0.8, sweep: 700 });
      this.tone({ frequency: 180, endFrequency: 70, duration: 0.08, type: 'square', gain: 0.1 });
    } else if (kind === 'shotgun') {
      this.burst({ duration: 0.3, gain: 0.42, cutoff: 1200, q: 0.6, sweep: 300 });
    } else {
      this.burst({ duration: 0.16, gain: 0.3, cutoff: 1900, q: 0.9, sweep: 520 });
      this.tone({ frequency: 240, endFrequency: 90, duration: 0.09, type: 'triangle', gain: 0.12 });
    }
  }

  punch() {
    this.burst({ duration: 0.09, gain: 0.2, cutoff: 420, q: 1.6, sweep: 120 });
  }

  impact(strength = 1) {
    const level = Math.min(1, strength);
    this.burst({ duration: 0.2 + level * 0.15, gain: 0.18 + level * 0.3, cutoff: 320, q: 0.7, sweep: 90 });
    this.tone({ frequency: 90, endFrequency: 40, duration: 0.22, type: 'sawtooth', gain: 0.1 * level });
  }

  horn() {
    this.tone({ frequency: 392, duration: 0.28, type: 'square', gain: 0.08 });
    this.tone({ frequency: 294, duration: 0.3, type: 'square', gain: 0.07, delay: 0.02 });
  }

  blip(up = true) {
    this.tone({ frequency: up ? 660 : 440, endFrequency: up ? 990 : 330, duration: 0.09, type: 'triangle', gain: 0.1 });
  }

  cash() {
    this.tone({ frequency: 880, duration: 0.08, type: 'triangle', gain: 0.12 });
    this.tone({ frequency: 1320, duration: 0.12, type: 'triangle', gain: 0.1, delay: 0.07 });
  }

  alarm() {
    this.tone({ frequency: 520, endFrequency: 880, duration: 0.3, type: 'sawtooth', gain: 0.08 });
  }

  footstep() {
    this.burst({ duration: 0.05, gain: 0.05, cutoff: 900, q: 1.4 });
  }

  /** A continuous engine note whose pitch and filter track the car's speed. */
  startEngine() {
    if (!this.context || this.engine) return;
    const osc = this.context.createOscillator();
    const sub = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const amp = this.context.createGain();
    osc.type = 'sawtooth';
    sub.type = 'square';
    osc.frequency.value = 60;
    sub.frequency.value = 30;
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 3;
    amp.gain.value = 0.0001;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(amp).connect(this.effectBus);
    osc.start();
    sub.start();
    this.engine = { osc, sub, filter, amp };
  }

  updateEngine(speedRatio, throttle, active) {
    if (!this.context) return;
    if (active && !this.engine) this.startEngine();
    if (!this.engine) return;
    const target = active ? 0.055 + Math.min(1, speedRatio) * 0.075 : 0.0001;
    const pitch = 46 + Math.min(1.4, speedRatio) * 120 + Math.abs(throttle) * 12;
    this.engine.osc.frequency.setTargetAtTime(pitch, this.now, 0.08);
    this.engine.sub.frequency.setTargetAtTime(pitch * 0.5, this.now, 0.1);
    this.engine.filter.frequency.setTargetAtTime(380 + speedRatio * 1400, this.now, 0.1);
    this.engine.amp.gain.setTargetAtTime(target, this.now, 0.12);
  }

  stopEngine() {
    if (this.engine) this.engine.amp.gain.setTargetAtTime(0.0001, this.now, 0.1);
  }

  /** The two-tone siren: an LFO swings a square wave between two notes. */
  setSiren(on) {
    if (!this.context) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on && !this.siren) {
      const osc = this.context.createOscillator();
      const lfo = this.context.createOscillator();
      const lfoGain = this.context.createGain();
      const amp = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      osc.type = 'square';
      osc.frequency.value = 720;
      lfo.type = 'triangle';
      lfo.frequency.value = 1.6;
      lfoGain.gain.value = 190;
      lfo.connect(lfoGain).connect(osc.frequency);
      filter.type = 'lowpass';
      filter.frequency.value = 1800;
      amp.gain.value = 0.0001;
      osc.connect(filter).connect(amp).connect(this.effectBus);
      osc.start();
      lfo.start();
      this.siren = { osc, lfo, amp };
    }
    if (this.siren) this.siren.amp.gain.setTargetAtTime(on ? 0.05 : 0.0001, this.now, 0.2);
  }

  /** Called once per frame: schedules the next few sixteenths of the soundtrack. */
  tickMusic(intensity) {
    if (!this.context) return;
    this.intensity = intensity;
    const tempo = 92 + intensity * 26;
    const stepDuration = 60 / tempo / 4;
    while (this.musicTime < this.now + 0.25) {
      this.scheduleStep(this.musicStep, this.musicTime, intensity, stepDuration);
      this.musicTime += stepDuration;
      this.musicStep = (this.musicStep + 1) % 32;
    }
  }

  scheduleStep(step, time, intensity, stepDuration) {
    const context = this.context;
    const bus = this.musicBus;
    const kickSteps = intensity > 0.5 ? [0, 3, 8, 11, 16, 19, 24, 27] : [0, 8, 16, 24];
    const delay = Math.max(0, time - this.now);
    if (kickSteps.includes(step)) {
      const osc = context.createOscillator();
      const amp = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.18);
      amp.gain.setValueAtTime(0.5, time);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
      osc.connect(amp).connect(bus);
      osc.start(time);
      osc.stop(time + 0.3);
    }
    if (step % 2 === 0 && intensity > 0.15) {
      this.burst({ duration: 0.04, gain: 0.05 + intensity * 0.05, cutoff: 7200, q: 1.4, delay });
    }
    if (step % 8 === 4 || (intensity > 0.7 && step % 4 === 2)) {
      this.burst({ duration: 0.14, gain: 0.06 + intensity * 0.07, cutoff: 1900, q: 0.8, delay });
    }
    if (step % 2 === 0) {
      const noteIndex = Math.floor(step / 2) % SCALE.length;
      const octave = step >= 16 ? 2 : 1;
      const frequency = 55 * Math.pow(2, (SCALE[noteIndex] + (octave - 1) * 12) / 12);
      const osc = context.createOscillator();
      const filter = context.createBiquadFilter();
      const amp = context.createGain();
      osc.type = intensity > 0.6 ? 'sawtooth' : 'triangle';
      osc.frequency.value = frequency;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240 + intensity * 900, time);
      filter.frequency.exponentialRampToValueAtTime(160, time + stepDuration * 3);
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.exponentialRampToValueAtTime(0.14 + intensity * 0.1, time + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + stepDuration * 3.4);
      osc.connect(filter).connect(amp).connect(bus);
      osc.start(time);
      osc.stop(time + stepDuration * 3.6);
    }
  }
}
