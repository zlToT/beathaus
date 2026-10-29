// ============================================================
// StageScene — Three.js 演唱会场景总装：
// 场地（主舞台 / 延伸 T 台 / 大屏 / 侧屏 / 线阵列音箱 / 桁架）/
// 灯光 / 粒子 / 人形观众 / 机器人；
// 后处理：Bloom + 全屏干涉噪点；
// 镜头模式（静止 / 轻微环绕 / 节拍推进 / 全景俯视）+ 屏幕震动
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { StageScreen } from './StageScreen.js';
import { Lights } from './Lights.js';
import { Particles } from './Particles.js';
import { Crowd } from './Crowd.js';
import { RobotVJ } from './RobotVJ.js';
import { AmbientBeams } from './AmbientBeams.js';
import { SectionFX } from './SectionFX.js';

// 全屏噪点 / 扫描线 shader
const NoiseShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    amount: { value: 0.1 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float amount;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = (rand(vUv * vec2(900.0, 600.0) + fract(time)) - 0.5) * amount;
      float scan = sin(vUv.y * 1000.0) * 0.014;
      c.rgb += n + scan;
      gl_FragColor = c;
    }
  `
};

export class StageScene {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0612);
    this.scene.fog = new THREE.FogExp2(0x0a0612, 0.02);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 120);
    this.camera.position.set(0, 4, 16.5);

    this._buildVenue();

    // 子模块
    this.screen = new StageScreen();
    // 大屏放大（18 × 9）
    this.screen.mesh.geometry = new THREE.PlaneGeometry(18, 9);
    this.screen.mesh.position.set(0, 6.8, -6.2);
    this.scene.add(this.screen.mesh);

    this._buildSideScreens();

    this.lights = new Lights(this.scene);
    this.particles = new Particles(this.scene);
    this.crowd = new Crowd(this.scene);
    this.robots = new RobotVJ(this.scene);
    this.ambient = new AmbientBeams(this.scene);
    this.sectionFX = new SectionFX(this.scene);

    // 后处理
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.7, 0.4, 0.35
    );
    this.composer.addPass(this.bloom);
    this.noisePass = new ShaderPass(NoiseShader);
    this.composer.addPass(this.noisePass);

    this._lastT = performance.now();

    window.addEventListener('resize', () => this._onResize());
  }

  _buildVenue() {
    // 地面
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x0c0718, roughness: 0.9, metalness: 0.15 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const darkStage = new THREE.MeshStandardMaterial({ color: 0x140b28, roughness: 0.7, metalness: 0.3 });

    // 主舞台（更大）
    const stage = new THREE.Mesh(new THREE.BoxGeometry(28, 0.8, 10), darkStage);
    stage.position.set(0, 0.4, -1);
    this.scene.add(stage);

    // 延伸 T 台（向观众席延伸）
    const tRunway = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 5), darkStage);
    tRunway.position.set(0, 0.4, 6);
    this.scene.add(tRunway);

    // 舞台包围线：淡淡白色细线，把机器人区域围在舞台中
    const frameLineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.32
    });
    const X0 = 9, Z_FRONT = 4, Z_BACK = -2;
    const lineY = 0.85;
    const fFront = new THREE.Mesh(new THREE.BoxGeometry(X0 * 2, 0.04, 0.04), frameLineMat);
    fFront.position.set(0, lineY, Z_FRONT);
    const fBack = new THREE.Mesh(new THREE.BoxGeometry(X0 * 2, 0.04, 0.04), frameLineMat);
    fBack.position.set(0, lineY, Z_BACK);
    const fLen = Z_FRONT - Z_BACK;
    const fLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, fLen), frameLineMat);
    fLeft.position.set(-X0, lineY, (Z_FRONT + Z_BACK) / 2);
    const fRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, fLen), frameLineMat);
    fRight.position.set(X0, lineY, (Z_FRONT + Z_BACK) / 2);
    this.scene.add(fFront, fBack, fLeft, fRight);
    // T 台两侧发光条
    [-1.5, 1.5].forEach((x) => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 5),
        new THREE.MeshBasicMaterial({ color: 0xff4fd8 })
      );
      strip.position.set(x, 0.82, 6);
      this.scene.add(strip);
    });

    // 大屏框
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0d0820, roughness: 0.6, metalness: 0.5 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(19, 9.8, 0.3), frameMat);
    frame.position.set(0, 6.8, -6.45);
    this.scene.add(frame);

    // 主桁架（横跨）
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x0d0820, metalness: 0.8, roughness: 0.4 });
    const truss = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 0.2), trussMat);
    truss.position.set(0, 10, 0);
    this.scene.add(truss);
    // 竖桁架柱
    [-13, 13].forEach((x) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.2, 10, 0.2), trussMat);
      col.position.set(x, 5, 0);
      this.scene.add(col);
    });

    // 线阵列吊挂音箱（两侧各一串）
    const spkMat = new THREE.MeshStandardMaterial({ color: 0x120b24, roughness: 0.8 });
    [-11, 11].forEach((x) => {
      for (let i = 0; i < 6; i++) {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), spkMat);
        cab.position.set(x, 8.6 - i * 0.62, 0);
        cab.rotation.z = (x < 0 ? -1 : 1) * 0.1;
        this.scene.add(cab);
      }
    });

    // 后墙 / 侧墙
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b0618, roughness: 1 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(70, 32), wallMat);
    back.position.set(0, 10, -9);
    this.scene.add(back);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(50, 32), wallMat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-18, 10, 6);
    this.scene.add(left);
    const right = new THREE.Mesh(new THREE.PlaneGeometry(50, 32), wallMat);
    right.rotation.y = -Math.PI / 2;
    right.position.set(18, 10, 6);
    this.scene.add(right);
  }

  // 侧屏：复用大屏同一画面
  _buildSideScreens() {
    const mat = new THREE.MeshBasicMaterial({ map: this.screen.texture });
    this.sideL = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6), mat);
    this.sideL.position.set(-12.8, 5, -2);
    this.sideL.rotation.y = 0.45;
    this.scene.add(this.sideL);
    this.sideR = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 6), mat);
    this.sideR.position.set(12.8, 5, -2);
    this.sideR.rotation.y = -0.45;
    this.scene.add(this.sideR);
  }

  setPrimaryColor(hex) {
    this.lights.setColor(hex);
    this.particles.setColor(hex);
    this.crowd.setColor(hex);
    this.robots.setColor(hex);
    this.ambient.setColor(hex);
    this.sectionFX.setColor(hex);
  }

  update(analysis, vj, tSec) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastT) / 1000);
    this._lastT = now;

    this.screen.update(analysis, vj, tSec);
    this.lights.update(vj, analysis, tSec);
    this.particles.update(vj, analysis, tSec, dt);
    this.crowd.update(vj, analysis, tSec);
    this.robots.update(vj, analysis, tSec);
    this.ambient.update(vj, analysis, tSec);
    this.sectionFX.update(dt, tSec);

    this.noisePass.uniforms.time.value = tSec;
    this.noisePass.uniforms.amount.value = vj.noiseOn ? 0.1 : 0;

    this._updateCamera(vj, analysis, tSec);

    this.composer.render();
  }

  // 镜头模式 + 屏幕震动
  _updateCamera(vj, analysis, t) {
    const bass = analysis.bass || 0;
    const pulse = analysis.beatPulse || 0;

    let px = 0, py = 4, pz = 16.5;
    let tx = 0, ty = 3, tz = -2;

    switch (vj.cameraMode) {
      case 'orbit': {
        // 前方轻微环绕（角度在 ±0.5 rad 内摆动）
        const a = Math.sin(t * 0.15) * 0.5;
        px = Math.sin(a) * 16;
        pz = Math.cos(a) * 16;
        py = 4;
        break;
      }
      case 'beat':
        pz = 16.5 - pulse * 1.4;
        py = 4;
        break;
      case 'overview':
        // 舞台正对面看台：高度适中、平视舞台，可见整个舞台 + 观众，轻微浮动
        px = Math.sin(t * 0.4) * 0.35;
        py = 6 + Math.sin(t * 0.6) * 0.3;
        pz = 22 + Math.sin(t * 0.5) * 0.35;
        ty = 3;
        break;
      default:
        break;
    }

    // 屏幕震动：强度 ×（BASS 叠加）
    const s = vj.shakeIntensity * (0.3 + bass * 0.9 + pulse * 0.3);
    px += (Math.random() - 0.5) * s;
    py += (Math.random() - 0.5) * s;
    pz += (Math.random() - 0.5) * s * 0.5;

    this.camera.position.set(px, py, pz);
    this.camera.lookAt(tx, ty, tz);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }
}
