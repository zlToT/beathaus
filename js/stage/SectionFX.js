// ============================================================
// SectionFX — 段落驱动的舞台特效
//   Drop（高潮）：彩色气球从观众席飘上 + 舞台上方撒彩带
//   Build（蓄力）：光点向舞台加速聚拢上升
//   Intro（开场）：少量轻柔上升光点
//   Break（间奏）：稀疏缓慢光点
//   Groove（律动）：稳定流动光点
// 由 main.js 在段落标签切换时调用 onSection()
// ============================================================

import * as THREE from 'three';

const BALLOON_COLORS = [0xff4fd8, 0x35e0ff, 0x9b5cff, 0xff7a2f, 0x39ff8b, 0xffe14f];
const CONFETTI_COLORS = [0xff4fd8, 0x35e0ff, 0x9b5cff, 0xff7a2f, 0x39ff8b, 0xffe14f, 0xffffff];
const MAX_BALLOONS = 26;
const MAX_CONFETTI = 130;
const SPARK_COUNT = 240;

// 各段落光点参数：数量 / 上升速度 / 是否向舞台聚拢
const SPARK_CFG = {
  intro: { count: 60, speed: 1.2, gather: false },
  build: { count: 220, speed: 3.4, gather: true },
  drop: { count: 100, speed: 2.2, gather: false },
  break: { count: 24, speed: 0.8, gather: false },
  groove: { count: 80, speed: 1.6, gather: false }
};

export class SectionFX {
  constructor(scene) {
    this.section = 'groove';

    // ---------- 气球 ----------
    this.balloons = [];
    for (let i = 0; i < MAX_BALLOONS; i++) {
      const g = this._makeBalloon();
      g.visible = false;
      scene.add(g);
      this.balloons.push(g);
    }

    // ---------- 彩带 ----------
    this.confetti = [];
    for (let i = 0; i < MAX_CONFETTI; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.22),
        new THREE.MeshBasicMaterial({
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          side: THREE.DoubleSide
        })
      );
      m.visible = false;
      scene.add(m);
      this.confetti.push(m);
    }

    // ---------- 段落光点 ----------
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkPos = new Float32Array(SPARK_COUNT * 3);
    for (let i = 0; i < SPARK_COUNT; i++) this._resetSpark(i);
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkMat = new THREE.PointsMaterial({
      size: 0.13,
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.sparks = new THREE.Points(this.sparkGeo, this.sparkMat);
    this.sparkGeo.setDrawRange(0, 0);
    scene.add(this.sparks);
  }

  // ---------- 气球 ----------
  _makeBalloon() {
    const g = new THREE.Group();
    const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 18),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.1
      })
    );
    // 高光小点
    const hi = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
    );
    hi.position.set(-0.1, 0.12, 0.22);
    // 细绳
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.62, 6),
      new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.55 })
    );
    string.position.y = -0.58;
    g.add(ball, hi, string);
    return g;
  }

  _spawnBalloon() {
    const g = this.balloons.find((b) => !b.visible);
    if (!g) return;
    g.visible = true;
    g.position.set(
      (Math.random() - 0.5) * 22,
      0.8,
      6 + Math.random() * 8
    );
    g.userData.vy = 0.7 + Math.random() * 0.6;
    g.userData.sway = Math.random() * Math.PI * 2;
    g.userData.swayAmp = 0.3 + Math.random() * 0.4;
  }

  _spawnConfetti() {
    const m = this.confetti.find((c) => !c.visible);
    if (!m) return;
    m.visible = true;
    m.position.set(
      (Math.random() - 0.5) * 20,
      11 + Math.random() * 2,
      -2 + Math.random() * 5
    );
    m.userData.vy = -(1.6 + Math.random() * 1.8);
    m.userData.vx = (Math.random() - 0.5) * 0.8;
    m.userData.vz = (Math.random() - 0.5) * 0.6;
    m.userData.rx = (Math.random() - 0.5) * 6;
    m.userData.ry = (Math.random() - 0.5) * 6;
  }

  // ---------- 光点 ----------
  _resetSpark(i) {
    this.sparkPos[i * 3] = (Math.random() - 0.5) * 24;
    this.sparkPos[i * 3 + 1] = 0.8 + Math.random() * 2;
    this.sparkPos[i * 3 + 2] = 6 + Math.random() * 8;
  }

  // 段落切换（标签为 Intro/Build/Drop/Break/Groove，统一转小写）
  onSection(section) {
    const key = (section || '').toLowerCase();
    if (key === this.section) return;
    this.section = key;
    if (key === 'drop') {
      for (let i = 0; i < 16; i++) this._spawnBalloon();
      for (let i = 0; i < 110; i++) this._spawnConfetti();
    }
  }

  setColor(hex) {
    this.sparkMat.color.set(hex);
  }

  update(dt, t) {
    const d = Math.min(0.05, dt || 0.016);

    // 气球：慢悠悠上升 + 左右轻摆
    this.balloons.forEach((g) => {
      if (!g.visible) return;
      const u = g.userData;
      u.sway += d * 1.4;
      g.position.y += u.vy * d;
      g.position.x += Math.sin(u.sway) * u.swayAmp * d;
      g.rotation.z = Math.sin(u.sway) * 0.15;
      if (g.position.y > 12.5) g.visible = false;
    });

    // 彩带：飘落 + 翻转
    this.confetti.forEach((m) => {
      if (!m.visible) return;
      const u = m.userData;
      m.position.y += u.vy * d;
      m.position.x += u.vx * d;
      m.position.z += u.vz * d;
      m.rotation.x += u.rx * d;
      m.rotation.y += u.ry * d;
      if (m.position.y < 0.5) m.visible = false;
    });

    // 段落光点
    const cfg = SPARK_CFG[this.section] || SPARK_CFG.groove;
    this.sparkGeo.setDrawRange(0, cfg.count);
    for (let i = 0; i < cfg.count; i++) {
      let x = this.sparkPos[i * 3];
      let y = this.sparkPos[i * 3 + 1];
      let z = this.sparkPos[i * 3 + 2];
      y += cfg.speed * d;
      if (cfg.gather) {
        // Build：向舞台中心聚拢
        x += (0 - x) * 0.6 * d;
        z += (0 - z) * 0.6 * d;
      }
      this.sparkPos[i * 3] = x;
      this.sparkPos[i * 3 + 1] = y;
      this.sparkPos[i * 3 + 2] = z;
      if (y > 11 || (cfg.gather && z < -1.5)) this._resetSpark(i);
    }
    this.sparkGeo.attributes.position.needsUpdate = true;
  }
}
