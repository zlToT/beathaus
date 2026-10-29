// ============================================================
// AudioEngine — AudioContext 与全局信号路由
//
// Deck A → crossA ─┐
// Deck B → crossB ─┴→ lowShelf → highShelf → master → analyser → destination
// ============================================================

import { Deck } from './Deck.js';
import { AudioAnalyser } from './AudioAnalyser.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this._anim = null; // crossfader 自动渐变动画
  }

  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    this.crossA = ctx.createGain();
    this.crossB = ctx.createGain();

    this.lowShelf = ctx.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.value = 200;

    this.highShelf = ctx.createBiquadFilter();
    this.highShelf.type = 'highshelf';
    this.highShelf.frequency.value = 3000;

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;

    this.masterAnalyser = new AudioAnalyser(ctx, 2048, 0.8);

    this.deckA = new Deck(ctx, 'A');
    this.deckB = new Deck(ctx, 'B');

    this.deckA.output.connect(this.crossA);
    this.deckB.output.connect(this.crossB);
    this.crossA.connect(this.lowShelf);
    this.crossB.connect(this.lowShelf);
    this.lowShelf.connect(this.highShelf);
    this.highShelf.connect(this.master);
    this.master.connect(this.masterAnalyser.input);
    this.masterAnalyser.input.connect(ctx.destination);

    this.setCrossfader(0.5);
    this.ready = true;
  }

  async resume() {
    this.init();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  // f ∈ [0,1]，0 全 A，1 全 B；等功率曲线
  setCrossfader(f) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const theta = f * Math.PI / 2;
    this.crossA.gain.setTargetAtTime(Math.cos(theta), t, 0.02);
    this.crossB.gain.setTargetAtTime(Math.sin(theta), t, 0.02);
    this._f = f;
  }

  // 自动渐变到目标侧（约 1 秒），由主循环 tick 推进
  moveCrossfaderTo(target) {
    const start = this._f ?? 0.5;
    const duration = Math.max(0.2, Math.abs(target - start) * 1.6);
    this._anim = { from: start, to: target, t0: performance.now(), duration };
  }

  tick() {
    if (this._anim) {
      const k = Math.min(1, (performance.now() - this._anim.t0) / (this._anim.duration * 1000));
      const ease = k * k * (3 - 2 * k);
      const f = this._anim.from + (this._anim.to - this._anim.from) * ease;
      this.setCrossfader(f);
      if (k >= 1) this._anim = null;
    }
  }

  setHighEq(db) {
    if (!this.ctx) return;
    this.highShelf.gain.setTargetAtTime(db, this.ctx.currentTime, 0.03);
  }

  setLowEq(db) {
    if (!this.ctx) return;
    this.lowShelf.gain.setTargetAtTime(db, this.ctx.currentTime, 0.03);
  }

  setMasterVolume(v) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  // 每帧分析：返回 { energy, bass, freq, wave }
  analyze() {
    const a = this.masterAnalyser;
    const freq = a.getFrequencyData();
    const wave = a.getTimeData();
    const rawEnergy = a.rms();
    const rawBass = a.bandLevel(20, 150);
    return {
      rawEnergy,
      rawBass,
      freq,
      wave
    };
  }
}
