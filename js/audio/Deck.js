// ============================================================
// Deck — 单路唱盘：加载 / 播放 / 暂停 / 多 Cue / seek / 音量 /
//        滤波 / 搓碟（物理跟随，可倒放）
//
// 信号链：BufferSource(每次播放重建) → lowpass → highpass → gain(output)
//                                              output → analyser(tap)
//
// 位置跟踪：使用"积分位置" _pos，每帧按当前 playbackRate 积分，
//           支持搓碟时的正负速率（倒放）与任意变速。
// ============================================================

import { BPMDetector } from './BPMDetector.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Deck {
  constructor(ctx, label) {
    this.ctx = ctx;
    this.label = label;

    this.buffer = null;
    this.bpm = null;

    // 节点
    this.output = ctx.createGain();
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000;
    this.lowpass.Q.value = 1;
    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 20;
    this.highpass.Q.value = 1;
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 1024;
    this.analyserNode.smoothingTimeConstant = 0.7;

    this.lowpass.connect(this.highpass);
    this.highpass.connect(this.output);
    this.output.connect(this.analyserNode); // tap，不影响下游

    // 播放状态
    this.source = null;
    this._pos = 0;              // 积分位置（秒）
    this._lastCtxTime = 0;
    this.isPlaying = false;
    this.cuePoints = [];         // 多 Cue（秒，升序）
    this.volume = 0.8;
    // 搓碟
    this._scratching = false;
    this._wasPlaying = false;
    this._lastCueCheckPos = 0;
  }

  // 加载音频文件
  async load(file) {
    const arr = await file.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arr);
    this.buffer = buffer;
    this.stopSource();
    this.isPlaying = false;
    this._pos = 0;
    this.cuePoints = [];
    this._lastCueCheckPos = 0;
    this.bpm = await BPMDetector.detect(buffer);
    return {
      name: file.name.replace(/\.[^.]+$/, ''),
      duration: buffer.duration,
      bpm: this.bpm
    };
  }

  _start() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 1;
    src.connect(this.lowpass);
    const offset = clamp(this._pos, 0, this.buffer.duration - 0.02);
    src.start(0, offset);
    src.onended = () => {
      // 自然播完（非手动 stop）时停在结尾
      if (this.source === src) {
        this.isPlaying = false;
        if (!this._scratching) this._pos = this.buffer.duration;
        this.source = null;
      }
    };
    this.source = src;
    this._lastCtxTime = this.ctx.currentTime;
    this.isPlaying = true;
  }

  play() {
    if (!this.buffer || this.isPlaying) return;
    // 在结尾处按播放 → 回到开头
    if (this._pos >= this.buffer.duration - 0.02) this._pos = 0;
    this._start();
  }

  // 积分位置：把上次到现在的时间按当前速率累加
  _flushPos() {
    if (this.isPlaying && this.source) {
      const now = this.ctx.currentTime;
      const dt = now - this._lastCtxTime;
      if (dt > 0) {
        this._pos += dt * this.source.playbackRate.value;
        this._lastCtxTime = now;
        if (this._pos <= 0) this._pos = 0;
        if (this._pos >= this.buffer.duration) this._pos = this.buffer.duration;
      }
    }
  }

  pause() {
    if (!this.isPlaying) return;
    this._flushPos();
    this.stopSource();
    this.isPlaying = false;
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  stopSource() {
    if (this.source) {
      const s = this.source;
      this.source = null; // 先清标记，onended 不再处理
      try { s.onended = null; s.stop(); } catch (e) { /* 已停止 */ }
      try { s.disconnect(); } catch (e) { /* ignore */ }
    }
  }

  seek(t) {
    if (!this.buffer) return;
    const pos = clamp(t, 0, this.buffer.duration);
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.stopSource();
    this._pos = pos;
    this._lastCueCheckPos = pos; // 防止 seek 后误触发 Cue 自动暂停
    if (wasPlaying) this._start();
  }

  getPosition() {
    this._flushPos();
    return this._pos;
  }

  setVolume(v) {
    this.volume = v;
    this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  // Filter 旋钮：v ∈ [0,1]，0.5 直通；<0.5 低通收紧；>0.5 高通收紧
  setFilter(v) {
    const t = this.ctx.currentTime;
    if (v <= 0.5) {
      const k = v / 0.5; // 0..1
      const cutoff = 200 * Math.pow(100, k); // 200 → 20000
      this.lowpass.frequency.setTargetAtTime(cutoff, t, 0.02);
      this.highpass.frequency.setTargetAtTime(20, t, 0.02);
    } else {
      const k = (v - 0.5) / 0.5;
      const cutoff = 20 * Math.pow(100, k); // 20 → 2000
      this.lowpass.frequency.setTargetAtTime(20000, t, 0.02);
      this.highpass.frequency.setTargetAtTime(cutoff, t, 0.02);
    }
  }

  // ================= 多 Cue =================

  // 在当前位置打点（播放中也可，不打断播放）
  addCue() {
    this._flushPos();
    const p = this._pos;
    if (this.cuePoints.some((c) => Math.abs(c - p) < 0.4)) return -1;
    this.cuePoints.push(p);
    this.cuePoints.sort((a, b) => a - b);
    return this.cuePoints.indexOf(p);
  }

  // 删除某个时间点附近的 Cue
  removeCueAt(t) {
    const i = this.cuePoints.findIndex((c) => Math.abs(c - t) < 0.3);
    if (i >= 0) this.cuePoints.splice(i, 1);
    return i;
  }

  // 播放中正向越过某个 Cue → 自动停在该 Cue（seek / 搓碟不触发）
  checkCueAutoStop() {
    if (!this.buffer) return;
    if (!this.isPlaying || this._scratching) {
      this._lastCueCheckPos = this.getPosition();
      return;
    }
    this._flushPos();
    for (const c of this.cuePoints) {
      if (this._lastCueCheckPos < c - 0.001 && this._pos >= c) {
        this.stopSource();
        this.isPlaying = false;
        this._pos = c;
        this._lastCueCheckPos = c;
        return;
      }
    }
    this._lastCueCheckPos = this._pos;
  }

  // ================= 搓碟（物理跟随） =================

  // 开始搓碟：暂停时临时出声（模拟 CDJ 手转碟片发声）
  scratchBegin() {
    if (!this.buffer) return;
    this._scratching = true;
    this._wasPlaying = this.isPlaying;
    if (!this.isPlaying) {
      if (this._pos >= this.buffer.duration - 0.02) this._pos = 0;
      this._start();
    }
  }

  // rate 为物理速率：1 = 正常碟速，0 = 停，负值 = 倒放
  setScratchRate(rate) {
    if (!this.source) return;
    this.source.playbackRate.value = clamp(rate, -1.5, 1.5);
  }

  // 结束搓碟：原本在播放 → 恢复正常；原本暂停 → 停在当前位置
  scratchEnd() {
    if (!this._scratching) return;
    this._scratching = false;
    if (this._wasPlaying) {
      this.setScratchRate(1);
    } else {
      this.pause();
    }
  }
}
