// ============================================================
// StageScreen — 舞台大屏 VJ 视觉（Canvas2D → CanvasTexture）
// 模式：spiral / wave / bars / tunnel；可选干涉噪点与扫描线
// 强化：高饱和、图形铺满、节拍全屏爆发、频谱大幅驱动
// ============================================================

import * as THREE from 'three';
import { rgbToHsl, hslToRgb } from './colorUtils.js';

const W = 2048;
const H = 1024;

export class StageScreen {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 6.5),
      new THREE.MeshBasicMaterial({ map: this.texture })
    );
  }

  _hsl(h, s, l, a = 1) {
    const { r, g, b } = hslToRgb(h, s, l);
    return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  }

  update(analysis, vj, t) {
    const ctx = this.ctx;
    const { bass = 0, energy = 0, beatPulse = 0, freq, wave } = analysis;
    const hue = rgbToHsl(...this._rgb(vj.primaryColor)).h;

    // 背景：中心随 BASS 变亮，整体更有层次
    const bg = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, W * 0.72);
    bg.addColorStop(0, this._hsl(hue + 30, 0.8, 0.2 + bass * 0.16));
    bg.addColorStop(0.6, this._hsl(hue + 20, 0.7, 0.08 + bass * 0.05));
    bg.addColorStop(1, '#070210');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    switch (vj.screenMode) {
      case 'spiral': this._spiral(ctx, hue, t, bass, beatPulse, freq); break;
      case 'wave': this._wave(ctx, hue, t, wave, bass, beatPulse); break;
      case 'bars': this._bars(ctx, hue, freq, bass, beatPulse); break;
      case 'tunnel': this._tunnel(ctx, hue, t, bass, beatPulse); break;
    }

    // 节拍全屏闪光（Drop 鼓点更明显）
    if (beatPulse > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${beatPulse * 0.09})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 频谱模式下减弱噪点，避免柱子糊
    if (vj.noiseOn) this._noise(ctx, t, vj.screenMode === 'bars' ? 0.45 : 1);
    this.texture.needsUpdate = true;
  }

  _rgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m
      ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
      : [155, 92, 255];
  }

  // 螺旋：4 臂，铺满全屏，节拍爆发（尺寸相对画布，保持视觉占比）
  _spiral(ctx, hue, t, bass, beatPulse, freq) {
    const cx = W / 2;
    const cy = H / 2;
    const spiralHue = hue + 35;
    const arms = 4;
    const maxTheta = 15;
    const rBase = W * 0.0166;   // 原 1024 画布时的 17
    const rFreq = W * 0.0156;   // 原 16
    const dotR = H * 0.023;     // 原 12
    for (let arm = 0; arm < arms; arm++) {
      const phase = (arm * Math.PI * 2) / arms;
      ctx.beginPath();
      let k = 0;
      for (let theta = 0; theta < maxTheta; theta += 0.05) {
        const f = freq ? freq[k % 64] / 255 : 0;
        const r = theta * (rBase + beatPulse * rBase * 0.3) + f * rFreq * (0.5 + bass);
        const a = theta + t * (0.9 + bass * 0.5) + phase;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (theta === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        k++;
      }
      ctx.strokeStyle = this._hsl(spiralHue + arm * 10, 1, 0.58 + beatPulse * 0.22, 0.92);
      ctx.lineWidth = 4 + beatPulse * 5;
      ctx.shadowColor = this._hsl(spiralHue, 1, 0.6);
      ctx.shadowBlur = 26;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // 中心光点
    ctx.beginPath();
    ctx.arc(cx, cy, dotR + beatPulse * dotR * 1.7, 0, Math.PI * 2);
    ctx.fillStyle = this._hsl(spiralHue + 20, 1, 0.72, 0.95);
    ctx.shadowColor = this._hsl(spiralHue + 20, 1, 0.7);
    ctx.shadowBlur = 30;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // 波形：多层 + 下方填充（振幅相对画布，保持视觉占比）
  _wave(ctx, hue, t, wave, bass, beatPulse) {
    if (!wave) return;
    const off = H * 0.14;
    const layers = [
      { hue: hue, y: H / 2, amp: H * 0.33, w: 4, fill: true },
      { hue: hue + 60, y: H / 2 - off, amp: H * 0.16, w: 2.5, fill: false },
      { hue: hue - 50, y: H / 2 + off, amp: H * 0.16, w: 2.5, fill: false }
    ];
    const step = Math.max(1, Math.floor(wave.length / W));
    const yAt = (x, L) => {
      const v = (wave[Math.min(wave.length - 1, x * step)] - 128) / 128;
      return L.y + v * L.amp * (0.7 + bass + beatPulse * 0.3);
    };
    layers.forEach((L) => {
      // 填充
      if (L.fill) {
        ctx.beginPath();
        ctx.moveTo(0, L.y);
        for (let x = 0; x < W; x += 3) ctx.lineTo(x, yAt(x, L));
        ctx.lineTo(W, L.y);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, L.y - L.amp, 0, L.y + L.amp);
        g.addColorStop(0, this._hsl(L.hue, 1, 0.6, 0.35));
        g.addColorStop(1, this._hsl(L.hue + 40, 1, 0.5, 0.05));
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.beginPath();
      for (let x = 0; x < W; x += 2) {
        const y = yAt(x, L);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = this._hsl(L.hue, 1, 0.62, 0.9);
      ctx.lineWidth = L.w;
      ctx.shadowColor = this._hsl(L.hue, 1, 0.6);
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }

  // 频谱柱：中心对称镜像（低频居中、高频向两侧展开）
  // 颜色统一主色（不跨色相），避免橙/绿/黄在 Bloom 下糊成一片
  _bars(ctx, hue, freq, bass, beatPulse) {
    if (!freq) return;
    const bins = 30;          // 单侧 30 个频率（更稀疏）
    const gap = 5;
    const halfW = W / 2;
    const cell = (halfW - gap * 2) / bins; // 每柱（含 gap）宽度
    const bw = Math.max(2, cell - gap);
    const maxH = H * 0.44;
    for (let i = 0; i < bins; i++) {
      const v = freq[i] / 255;
      const bh = Math.max(2, v * maxH * (0.85 + bass * 0.5 + beatPulse * 0.3));
      // 同一色相，仅明度/饱和度随位置微变，外侧高频略暗
      const sat = 0.9 - i * 0.005;
      const topL = 0.5 - i * 0.004;
      const g = ctx.createLinearGradient(0, H / 2 - bh, 0, H / 2);
      g.addColorStop(0, this._hsl(hue, sat, topL));
      g.addColorStop(1, this._hsl(hue, sat * 0.9, 0.36));
      // 右柱 / 左柱（对称）
      const rx = halfW + gap + i * cell;
      const lx = halfW - gap - (i + 1) * cell;
      [rx, lx].forEach((x) => {
        ctx.fillStyle = g;
        ctx.fillRect(x, H / 2 - bh, bw, bh);
        // 下半镜像
        ctx.fillStyle = this._hsl(hue, sat * 0.9, 0.36, 0.4);
        ctx.fillRect(x, H / 2, bw, bh * 0.5);
      });
    }
  }

  // 粒子隧道：更多环，节拍爆发
  _tunnel(ctx, hue, t, bass, beatPulse) {
    const cx = W / 2;
    const cy = H / 2;
    const rings = 20;
    for (let i = 0; i < rings; i++) {
      const p = (i / rings + t * (0.12 + bass * 0.1)) % 1;
      const r = p * W * 0.78;
      const a = (1 - p) * 0.85;
      ctx.strokeStyle = this._hsl(hue + p * 130, 1, 0.58 + beatPulse * 0.2, a);
      ctx.lineWidth = 2 + (1 - p) * (5 + beatPulse * 4);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(cx - r * 0.7, cy - r * 0.42, r * 1.4, r * 0.84);
    }
  }

  // 干涉噪点：随机点 + 扫描线 + 移动干涉带（strength 控制强度）
  _noise(ctx, t, strength = 1) {
    const dots = Math.floor(2200 * strength);
    for (let i = 0; i < dots; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      ctx.fillStyle = Math.random() > 0.5
        ? `rgba(255,255,255,${Math.random() * 0.12})`
        : `rgba(0,0,0,${Math.random() * 0.2})`;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    for (let i = 0; i < 3; i++) {
      const y = ((t * (40 + i * 24) + i * 180) % (H + 80)) - 40;
      const g = ctx.createLinearGradient(0, y - 18, 0, y + 18);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.10)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 18, W, 36);
    }
  }
}
