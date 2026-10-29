// ============================================================
// Lights — 舞台灯光与光束
// 4 盏 SpotLight（配半透明光束体），支持 static / pulse / sweep / rainbow
// ============================================================

import * as THREE from 'three';
import { hexToRgb, rgbToHsl, hslToRgb } from './colorUtils.js';

export class Lights {
  constructor(scene) {
    this.scene = scene;
    this.ambient = new THREE.AmbientLight(0x3a2466, 0.7);
    scene.add(this.ambient);

    // 舞台顶光
    this.topFill = new THREE.PointLight(0x9b5cff, 1.2, 30, 1.6);
    this.topFill.position.set(0, 8.5, 0);
    scene.add(this.topFill);

    this.units = [];
    const xs = [-7.5, -2.6, 2.6, 7.5];
    xs.forEach((x, i) => {
      const color = new THREE.Color(0x9b5cff);
      const spot = new THREE.SpotLight(color, 60, 40, 0.32, 0.55, 1.4);
      spot.position.set(x, 9, 1);
      const target = new THREE.Object3D();
      target.position.set(x * 0.6, 1.5, 7);
      scene.add(target);
      spot.target = target;
      scene.add(spot);

      // 光束体：灯口向下张开的半透明锥/柱
      const beamLen = 11;
      const beamGeo = new THREE.CylinderGeometry(0.12, 2.4, beamLen, 24, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0x9b5cff,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      // 光束从灯口伸向 target（近似：中点位置 + 倾斜）
      beam.position.set(x, 9 - beamLen / 2, 4);
      beam.rotation.x = -0.28;
      scene.add(beam);

      this.units.push({ spot, target, beam, baseX: x, phase: i * 1.7 });
    });
  }

  setColor(hex) {
    this._color = hex;
    const { r, g, b } = hexToRgb(hex);
    this.topFill.color.setRGB(r / 255, g / 255, b / 255);
    this.units.forEach((u) => {
      u.spot.color.set(hex);
      u.beam.material.color.set(hex);
    });
  }

  update(vj, analysis, t) {
    const intensity = vj.lightIntensity;
    const bass = analysis.bass || 0;
    const pulse = analysis.beatPulse || 0;
    const mode = vj.lightMode;

    this.topFill.intensity = intensity * (1.2 + pulse * 1.6);

    this.units.forEach((u) => {
      let color = this._color || vj.primaryColor;
      let mult = 1;
      let tx = u.baseX * 0.6;

      switch (mode) {
        case 'static':
          mult = 1;
          break;
        case 'pulse':
          mult = 0.5 + bass * 1.1 + pulse * 0.8;
          break;
        case 'sweep':
          tx = Math.sin(t * 1.1 + u.phase) * 7;
          mult = 0.8 + pulse * 0.8;
          break;
        case 'rainbow': {
          const base = rgbToHsl(155, 92, 255);
          const { r, g, b } = hslToRgb((t * 45 + u.phase * 50) % 360, 1, 0.6);
          const c = new THREE.Color(r / 255, g / 255, b / 255);
          u.spot.color = c;
          u.beam.material.color = c;
          mult = 0.9 + pulse * 0.8;
          break;
        }
      }
      if (mode !== 'rainbow') {
        u.spot.color.set(color);
        u.beam.material.color.set(color);
      }
      u.spot.intensity = 55 * intensity * mult;
      u.target.position.x = tx;
      u.target.position.y = 1.5 + pulse * 0.6;
      u.beam.material.opacity = (0.05 + bass * 0.1 + pulse * 0.05) * intensity;
      u.beam.rotation.z = (tx - u.baseX * 0.6) * 0.02;
    });
  }
}
