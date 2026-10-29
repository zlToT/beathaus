// ============================================================
// AmbientBeams — 演唱会激光束（扫射 / 彩虹循环共用同一批光束）
// · 多个发射点（舞台上方前沿），光束斜向（30–60° 动态变化）射出，
//   略微下压，可扫到观众席；
// · sweep：单色（主色）；
// · rainbow：光束颜色改为彩虹渐变流动。
// ============================================================

import * as THREE from 'three';

const BEAM_LEN = 18;
const TILT = 0.55; // 向下俯仰（弧度）：从大屏顶斜射向观众席
// 发射点位于大屏上边（大屏中心 y=6.8、高 9 → 顶 y≈11.3；大屏 z=-6.2）
const EMIT_Y = 11.3;
const EMIT_Z = -6.2;

// 发射点：x 位置（大屏宽内）+ 基准方位角（+Z 直射观众为 90）+ 摆动范围
const EMITTERS = [
  { x: -8,   base: 120, range: 20 },
  { x: -5.5, base: 110, range: 20 },
  { x: -2.5, base: 95,  range: 25 },
  { x: -0.8, base: 90,  range: 30 },
  { x: 0.8,  base: 90,  range: 30 },
  { x: 2.5,  base: 85,  range: 25 },
  { x: 5.5,  base: 70,  range: 20 },
  { x: 8,    base: 60,  range: 20 }
];

export class AmbientBeams {
  constructor(scene) {
    this.beams = [];

    EMITTERS.forEach((e, i) => {
      // 光束平面（长沿 X，水平），一端在 pivot 原点
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9b5cff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BEAM_LEN, 0.12), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.x = BEAM_LEN / 2;

      // 下压
      const tilt = new THREE.Group();
      tilt.rotation.z = -TILT;
      tilt.add(mesh);

      // 方位（发射点在大屏上边）
      const pivot = new THREE.Group();
      pivot.position.set(e.x, EMIT_Y, EMIT_Z);
      pivot.visible = false;
      pivot.add(tilt);
      scene.add(pivot);

      this.beams.push({
        pivot, mat,
        base: (e.base * Math.PI) / 180,
        range: (e.range * Math.PI) / 180,
        speed: 0.7 + (i % 4) * 0.18,
        phase: i * 1.3
      });
    });
  }

  setColor(hex) {
    this.beams.forEach((b) => { if (!b.rainbow) b.mat.color.set(hex); });
  }

  update(vj, analysis, t) {
    const mode = vj.lightMode;
    const intensity = vj.lightIntensity;
    const pulse = analysis.beatPulse || 0;
    const on = mode === 'sweep' || mode === 'rainbow';

    this.beams.forEach((b, i) => {
      b.pivot.visible = on;
      if (!on) return;
      // 方位角动态摆动
      const theta = b.base + Math.sin(t * b.speed + b.phase) * b.range;
      b.pivot.rotation.y = -theta; // Three.js：+X 旋转 φ 后指向 (cosφ,0,-sinφ)
      b.mat.opacity = (0.42 + pulse * 0.3) * intensity;

      if (mode === 'rainbow') {
        // 彩虹渐变：每束不同色相，随时间流动
        const h = (t * 55 + i * (360 / this.beams.length)) % 360;
        b.mat.color.setHSL(h / 360, 1, 0.6);
      } else {
        b.mat.color.set(vj.primaryColor);
      }
    });
  }
}
