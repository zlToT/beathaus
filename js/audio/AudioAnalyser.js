// ============================================================
// AudioAnalyser — 封装 AnalyserNode，提供 FFT / 时域 / 频段能量
// ============================================================

export class AudioAnalyser {
  constructor(ctx, fftSize = 2048, smoothing = 0.8) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = smoothing;
    this.sampleRate = ctx.sampleRate;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.time = new Uint8Array(this.analyser.fftSize);
    // input 即 analyser，可直接 connect
    this.input = this.analyser;
  }

  getFrequencyData() {
    this.analyser.getByteFrequencyData(this.freq);
    return this.freq;
  }

  getTimeData() {
    this.analyser.getByteTimeDomainData(this.time);
    return this.time;
  }

  // 频段平均值（0..1）
  bandLevel(f0, f1) {
    const binHz = this.sampleRate / 2 / this.freq.length;
    const i0 = Math.max(0, Math.floor(f0 / binHz));
    const i1 = Math.min(this.freq.length - 1, Math.ceil(f1 / binHz));
    let sum = 0;
    for (let i = i0; i <= i1; i++) sum += this.freq[i];
    return sum / (i1 - i0 + 1) / 255;
  }

  // 时域 RMS（0..1 左右）
  rms() {
    const t = this.time;
    let sum = 0;
    for (let i = 0; i < t.length; i++) {
      const x = (t[i] - 128) / 128;
      sum += x * x;
    }
    return Math.sqrt(sum / t.length);
  }
}
