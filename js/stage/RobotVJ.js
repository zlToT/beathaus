// ============================================================
// RobotVJ — 舞台机器人 VJ（4 个），分别站在四个光柱下；
// 四个机器人造型各异：
//   heart 爱心眼 / headphones 墨镜耳机 / radar 独眼雷达 / grin 咧嘴笑；
// 每个机器人脚下有抬高的发光平台（立体感）；
// 随节拍摆臂、转头、弹跳
// ============================================================

import * as THREE from 'three';

// 四个光柱灯头位置（与 Lights 一致）
const STAND_X = [-7.5, -2.6, 2.6, 7.5];
const STAND_Z = 1;
const PLATFORM_TOP = 1.1; // 平台顶面高度（机器人脚底）
const TYPES = ['heart', 'headphones', 'radar', 'grin'];

// 各机器人动作风格（频率 / 幅度 / 弹跳），避免四个机器人整齐划一
const ACTIONS = {
  heart: { // 爱心眼：轻柔、害羞、慢节奏
    armFreq: 1.4, armAmp: 0.2, armZ: 0.1,
    headYfreq: 0.5, headYamp: 0.2, headZfreq: 0.9, headZamp: 0.06,
    nodFreq: 0, nodAmp: 0, bounce: 0.08, scale: 0.03
  },
  headphones: { // 墨镜耳机：冷酷、缓慢点头
    armFreq: 1.2, armAmp: 0.15, armZ: 0.08,
    headYfreq: 0.3, headYamp: 0.12, headZfreq: 0.6, headZamp: 0.04,
    nodFreq: 0.8, nodAmp: 0.14, bounce: 0.07, scale: 0.03
  },
  radar: { // 独眼雷达：好奇、快速左右张望
    armFreq: 2.2, armAmp: 0.3, armZ: 0.14,
    headYfreq: 1.4, headYamp: 0.55, headZfreq: 1.2, headZamp: 0.1,
    nodFreq: 0, nodAmp: 0, bounce: 0.15, scale: 0.05
  },
  grin: { // 咧嘴笑：气氛组，大幅挥臂 + 高跳
    armFreq: 3.0, armAmp: 0.55, armZ: 0.2,
    headYfreq: 1.6, headYamp: 0.4, headZfreq: 1.8, headZamp: 0.14,
    nodFreq: 0, nodAmp: 0, bounce: 0.28, scale: 0.07
  }
};

export class RobotVJ {
  constructor(scene) {
    this.robots = [];
    this.platformEdges = [];

    STAND_X.forEach((x, i) => {
      this._buildPlatform(scene, x, STAND_Z);
      const type = TYPES[i];
      const r = this._build(type);
      r.group.position.set(x, PLATFORM_TOP, STAND_Z);
      r.phase = i * 1.4;
      r.type = type;
      this.robots.push(r);
      scene.add(r.group);
    });
  }

  // 抬高的发光平台：本体（厚 0.3，落在主舞台台面 0.8 上）+ 顶面四边发光条
  _buildPlatform(scene, x, z) {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.3, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x140b28, metalness: 0.5, roughness: 0.55 })
    );
    base.position.set(x, 0.95, z); // 中心 0.95，顶面 1.1
    scene.add(base);

    // 顶面四边发光条
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x9b5cff });
    const e = 1.8;
    const t = 0.05;
    const y = PLATFORM_TOP + 0.01;
    const strips = [
      [e, t, t, 0, y, e / 2],
      [e, t, t, 0, y, -e / 2],
      [t, t, e, e / 2, y, 0],
      [t, t, e, -e / 2, y, 0]
    ];
    strips.forEach(([w, h, d, sx, sy, sz]) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), edgeMat);
      s.position.set(x + sx, sy, z + sz);
      scene.add(s);
      this.platformEdges.push(s);
    });
  }

  _box(w, h, d, mat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }

  // 心形几何（在 XY 平面，朝 +Z）
  _heartGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, 0.06);
    s.bezierCurveTo(0, 0.16, -0.14, 0.16, -0.14, 0.04);
    s.bezierCurveTo(-0.14, -0.05, -0.02, -0.09, 0, -0.16);
    s.bezierCurveTo(0.02, -0.09, 0.14, -0.05, 0.14, 0.04);
    s.bezierCurveTo(0.14, 0.16, 0, 0.16, 0, 0.06);
    return new THREE.ShapeGeometry(s);
  }

  _build(type) {
    const group = new THREE.Group();
    // 跟随主色的发光材质
    const glowMats = [];
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x9b5cff });
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x9b5cff });
    glowMats.push(eyeMat, mouthMat);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1c1438, metalness: 0.65, roughness: 0.35
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x100a22, metalness: 0.7, roughness: 0.4
    });

    // 腿
    [-0.16, 0.16].forEach((x) => {
      const leg = this._box(0.18, 0.5, 0.2, darkMat);
      leg.position.set(x, 0.25, 0);
      group.add(leg);
      const foot = this._box(0.22, 0.08, 0.3, darkMat);
      foot.position.set(x, 0.04, 0.04);
      group.add(foot);
    });

    // 身体
    const body = this._box(0.7, 0.75, 0.4, bodyMat);
    body.position.y = 0.92;
    group.add(body);
    // 胸口发光面板
    const chest = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), mouthMat);
    chest.position.set(0, 0.98, 0.21);
    group.add(chest);

    // 手臂（pivot 在肩部）
    const armL = new THREE.Group();
    armL.position.set(-0.44, 1.15, 0);
    const armLMesh = this._box(0.14, 0.65, 0.14, bodyMat);
    armLMesh.position.y = -0.3;
    armL.add(armLMesh);
    group.add(armL);

    const armR = new THREE.Group();
    armR.position.set(0.44, 1.15, 0);
    const armRMesh = this._box(0.14, 0.65, 0.14, bodyMat);
    armRMesh.position.y = -0.3;
    armR.add(armRMesh);
    group.add(armR);

    // ---------- 头（差异化） ----------
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.55, 0);
    const head = this._box(0.55, 0.45, 0.45, bodyMat);
    headPivot.add(head);

    let radar = null;
    let antTip = null;

    if (type === 'heart') {
      // 爱心眼：两只心形（固定粉色，不跟随主色）
      const heartMat = new THREE.MeshBasicMaterial({ color: 0xff5a8a });
      const hg = this._heartGeo();
      const hL = new THREE.Mesh(hg, heartMat);
      hL.position.set(-0.14, 0.05, 0.24);
      hL.scale.setScalar(1.05);
      const hR = new THREE.Mesh(hg, heartMat);
      hR.position.set(0.14, 0.05, 0.24);
      hR.scale.setScalar(1.05);
      headPivot.add(hL, hR);
      // 小嘴
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), mouthMat);
      mouth.position.set(0, -0.14, 0.24);
      headPivot.add(mouth);
    }

    if (type === 'headphones') {
      // 耳机头梁（上半圆环，跨过头顶）
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.04, 10, 24, Math.PI),
        darkMat
      );
      band.position.y = 0.24;
      headPivot.add(band);
      // 两侧耳罩
      [-0.3, 0.3].forEach((x) => {
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), darkMat);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(x, 0.02, 0);
        headPivot.add(cup);
      });
      // 墨镜：一条横向发光条
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.03), eyeMat);
      visor.position.set(0, 0.05, 0.24);
      headPivot.add(visor);
      // 嘴
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), mouthMat);
      mouth.position.set(0, -0.14, 0.24);
      headPivot.add(mouth);
    }

    if (type === 'radar') {
      // 独眼：一只大眼睛居中
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), eyeMat);
      eye.position.set(0, 0.04, 0.22);
      headPivot.add(eye);
      // 头顶旋转雷达（十字）
      radar = new THREE.Group();
      radar.position.y = 0.36;
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), darkMat);
      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34), darkMat);
      radar.add(bar1, bar2);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), eyeMat);
      tip.position.set(0.16, 0, 0);
      radar.add(tip);
      headPivot.add(radar);
      // 嘴
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), mouthMat);
      mouth.position.set(0, -0.14, 0.24);
      headPivot.add(mouth);
    }

    if (type === 'grin') {
      // 普通眼睛
      const eyeGeo = new THREE.SphereGeometry(0.07, 12, 12);
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.14, 0.05, 0.24);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.14, 0.05, 0.24);
      headPivot.add(eyeL, eyeR);
      // 咧嘴：宽发光矩形 + 白色牙齿
      const grin = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.04), mouthMat);
      grin.position.set(0, -0.13, 0.24);
      headPivot.add(grin);
      const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let k = -1; k <= 1; k++) {
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), toothMat);
        tooth.position.set(k * 0.1, -0.13, 0.265);
        headPivot.add(tooth);
      }
      // 天线
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28), darkMat);
      ant.position.y = 0.36;
      headPivot.add(ant);
      antTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMat);
      antTip.position.y = 0.52;
      headPivot.add(antTip);
    }

    group.add(headPivot);
    group.scale.setScalar(0.9);
    return { group, armL, armR, headPivot, radar, antTip, eyeMat, mouthMat, glowMats };
  }

  setColor(hex) {
    this.robots.forEach((r) => {
      r.glowMats.forEach((m) => m.color.set(hex));
    });
    this.platformEdges.forEach((s) => s.material.color.set(hex));
  }

  update(vj, analysis, t) {
    const visible = vj.crowdOn;
    const bass = analysis.bass || 0;
    const pulse = analysis.beatPulse || 0;
    this.robots.forEach((r) => {
      r.group.visible = visible;
      if (!visible) return;
      const ph = r.phase;
      const A = ACTIONS[r.type];
      // 摆臂（基础慢摆 + 节拍爆发）
      const swing = Math.sin(t * A.armFreq + ph) * A.armAmp * 0.6
        + pulse * A.armAmp * (0.5 + bass) * 1.6;
      r.armL.rotation.x = swing;
      r.armR.rotation.x = -swing;
      r.armL.rotation.z = A.armZ + Math.sin(t * A.armFreq * 0.7 + ph) * A.armZ * 0.8;
      r.armR.rotation.z = -A.armZ - Math.sin(t * A.armFreq * 0.7 + ph) * A.armZ * 0.8;
      // 咧嘴笑：右臂高举过头挥手
      if (r.type === 'grin') {
        r.armR.rotation.z = -2.2 + Math.sin(t * 4 + ph) * 0.25;
        r.armR.rotation.x = -0.3;
      }
      // 转头 / 点头
      r.headPivot.rotation.y = Math.sin(t * A.headYfreq + ph) * A.headYamp;
      r.headPivot.rotation.z = Math.sin(t * A.headZfreq + ph) * A.headZamp;
      r.headPivot.rotation.x = A.nodAmp
        ? Math.sin(t * A.nodFreq + ph) * A.nodAmp + pulse * A.nodAmp
        : 0;
      // 弹跳 / 缩放
      r.group.position.y = PLATFORM_TOP + pulse * A.bounce * (0.5 + bass);
      const s = 0.9 * (1 + pulse * A.scale);
      r.group.scale.setScalar(s);
      if (r.antTip) r.antTip.scale.setScalar(1 + pulse * 0.8);
      if (r.radar) r.radar.rotation.y = t * 2.4;
    });
    // 平台随开关显示
    this.platformEdges.forEach((s) => { s.visible = visible; });
  }
}
