// ============================================================
// Crowd — 台下人形观众（InstancedMesh 分部件）
// 身体 + 头 + 举起的手臂，手持荧光棒（随机霓虹色）或手机（亮屏），
// 随节拍跳动、挥手
// ============================================================

import * as THREE from 'three';

const N = 130;
// 荧光棒霓虹色板
const STICK_COLORS = [0x9b5cff, 0xff4fd8, 0x35e0ff, 0x39ff8b, 0xffe14f, 0xff7a2f, 0xffffff];

export class Crowd {
  constructor(scene) {
    this.dummy = new THREE.Object3D();
    this.data = [];

    // 身体
    this.bodyGeo = new THREE.CapsuleGeometry(0.22, 0.55, 4, 8);
    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1030, roughness: 0.9, metalness: 0.1,
      emissive: new THREE.Color(0x9b5cff), emissiveIntensity: 0.1
    });
    this.body = new THREE.InstancedMesh(this.bodyGeo, this.bodyMat, N);

    // 头
    this.headGeo = new THREE.SphereGeometry(0.17, 10, 8);
    this.headMat = new THREE.MeshStandardMaterial({
      color: 0x241438, roughness: 0.85,
      emissive: new THREE.Color(0x9b5cff), emissiveIntensity: 0.08
    });
    this.head = new THREE.InstancedMesh(this.headGeo, this.headMat, N);

    // 举起的手臂
    this.armGeo = new THREE.BoxGeometry(0.07, 0.65, 0.07);
    this.armMat = new THREE.MeshStandardMaterial({ color: 0x160d2c, roughness: 0.9 });
    this.arm = new THREE.InstancedMesh(this.armGeo, this.armMat, N);

    // 荧光棒（自发光，instanceColor 随机霓虹色）
    this.stickGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6);
    this.stickMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.stick = new THREE.InstancedMesh(this.stickGeo, this.stickMat, N);

    // 手机（亮屏）
    this.phoneGeo = new THREE.BoxGeometry(0.13, 0.2, 0.02);
    this.phoneMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff });
    this.phone = new THREE.InstancedMesh(this.phoneGeo, this.phoneMat, N);

    [this.body, this.head, this.arm, this.stick, this.phone].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      scene.add(m);
    });

    this._populate();
  }

  _populate() {
    for (let i = 0; i < N; i++) {
      const z = 7 + Math.random() * 8;
      const half = 5 + (z - 7) * 0.9;
      const x = (Math.random() - 0.5) * 2 * half;
      const s = 0.8 + Math.random() * 0.35;
      const type = Math.random() < 0.68 ? 'stick' : 'phone';
      const side = Math.random() < 0.5 ? -1 : 1;
      this.data.push({
        x, z, s, type, side,
        armX: side * 0.3,
        phase: Math.random() * Math.PI * 2,
        wave: 0.6 + Math.random() * 0.5
      });
      if (type === 'stick') {
        const c = new THREE.Color(STICK_COLORS[(Math.random() * STICK_COLORS) | 0]);
        this.stick.setColorAt(i, c);
      }
    }
    if (this.stick.instanceColor) this.stick.instanceColor.needsUpdate = true;
  }

  setColor(hex) {
    this.bodyMat.emissive.set(hex);
    this.headMat.emissive.set(hex);
  }

  setVisible(v) {
    [this.body, this.head, this.arm, this.stick, this.phone].forEach((m) => { m.visible = v; });
  }

  update(vj, analysis, t) {
    const visible = vj.crowdOn;
    this.setVisible(visible);
    if (!visible) return;

    const bass = analysis.bass || 0;
    const pulse = analysis.beatPulse || 0;
    const bpm = analysis.bpm || 120;
    const beatClock = (t * bpm) / 60;

    for (let i = 0; i < N; i++) {
      const d = this.data[i];
      const hop = Math.pow(Math.max(0, Math.sin(beatClock * Math.PI * 2 + d.phase)), 2)
        * (0.1 + bass * 0.5 + pulse * 0.15);
      // 手臂挥动（举起的手臂左右摆动）
      const armWave = Math.sin(t * 2.4 * d.wave + d.phase) * 0.22 + pulse * 0.3;

      // 身体
      this.dummy.position.set(d.x, 0.95 * d.s + hop, d.z);
      this.dummy.rotation.set(0, 0, Math.sin(t * 1.6 + d.phase) * 0.05);
      this.dummy.scale.setScalar(d.s);
      this.dummy.updateMatrix();
      this.body.setMatrixAt(i, this.dummy.matrix);

      // 头
      this.dummy.position.set(d.x, 1.55 * d.s + hop, d.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(d.s);
      this.dummy.updateMatrix();
      this.head.setMatrixAt(i, this.dummy.matrix);

      // 举起的手臂
      this.dummy.position.set(d.x + d.armX * d.s, 1.62 * d.s + hop, d.z);
      this.dummy.rotation.set(0, 0, -d.side * armWave);
      this.dummy.scale.setScalar(d.s);
      this.dummy.updateMatrix();
      this.arm.setMatrixAt(i, this.dummy.matrix);

      if (d.type === 'stick') {
        // 荧光棒跟随手
        this.dummy.position.set(d.x + d.armX * d.s, 1.95 * d.s + hop, d.z);
        this.dummy.rotation.set(0, 0, -d.side * armWave);
        this.dummy.scale.setScalar(d.s);
        this.dummy.updateMatrix();
        this.stick.setMatrixAt(i, this.dummy.matrix);
        // 手机隐藏
        this._zero(this.phone, i);
      } else {
        // 手机跟随手
        this.dummy.position.set(d.x + d.armX * d.s, 1.9 * d.s + hop, d.z);
        this.dummy.rotation.set(0, 0, -d.side * armWave * 0.5);
        this.dummy.scale.setScalar(d.s);
        this.dummy.updateMatrix();
        this.phone.setMatrixAt(i, this.dummy.matrix);
        this._zero(this.stick, i);
      }
    }

    [this.body, this.head, this.arm, this.stick, this.phone].forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
    });
  }

  _zero(mesh, i) {
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.setScalar(0.0001);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(i, this.dummy.matrix);
  }
}
