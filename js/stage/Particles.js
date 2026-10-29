// ============================================================
// Particles — 舞台粒子系统，BASS 命中时向上爆发
// ============================================================

import * as THREE from 'three';
import { hexToRgb } from './colorUtils.js';

const COUNT = 700;

export class Particles {
  constructor(scene) {
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(COUNT * 3);
    this.colors = new Float32Array(COUNT * 3);
    this.vy = new Float32Array(COUNT);
    this.phase = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      this._reset(i, true);
      this.phase[i] = Math.random() * Math.PI * 2;
    }

    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.mat = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.points = new THREE.Points(this.geo, this.mat);
    scene.add(this.points);
  }

  _reset(i, initial = false) {
    this.pos[i * 3] = (Math.random() - 0.5) * 28;
    this.pos[i * 3 + 1] = initial ? Math.random() * 9 : 0;
    this.pos[i * 3 + 2] = -2 + Math.random() * 10;
    this.vy[i] = 0.1 + Math.random() * 0.25;
  }

  setColor(hex) {
    const { r, g, b } = hexToRgb(hex);
    for (let i = 0; i < COUNT; i++) {
      if (Math.random() < 0.22) {
        this.colors[i * 3] = 1; this.colors[i * 3 + 1] = 1; this.colors[i * 3 + 2] = 1;
      } else {
        const jitter = 0.7 + Math.random() * 0.3;
        this.colors[i * 3] = (r / 255) * jitter;
        this.colors[i * 3 + 1] = (g / 255) * jitter;
        this.colors[i * 3 + 2] = (b / 255) * jitter;
      }
    }
    this.geo.attributes.color.needsUpdate = true;
  }

  update(vj, analysis, t, dt) {
    this.points.visible = vj.particlesOn;
    if (!vj.particlesOn) return;
    const bass = analysis.bass || 0;
    const pulse = analysis.beatPulse || 0;
    const d = dt || 0.016;

    for (let i = 0; i < COUNT; i++) {
      const ph = this.phase[i];
      let y = this.pos[i * 3 + 1];
      y += (this.vy[i] + bass * 5 + pulse * 2) * d;
      this.pos[i * 3] += Math.sin(t * 1.5 + ph) * 0.01;
      this.pos[i * 3 + 1] = y;
      if (y > 9.5) this._reset(i);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.mat.size = 0.09 + pulse * 0.05;
  }
}
