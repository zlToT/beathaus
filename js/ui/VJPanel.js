// ============================================================
// VJPanel — VJ 视觉控制区：大屏 / 灯光 / 镜头 / 震动 / 开关
// ============================================================

import { state } from '../state.js';

export class VJPanel {
  constructor() {
    const screen = document.getElementById('vj-screen');
    const light = document.getElementById('vj-light');
    const intensity = document.getElementById('vj-intensity');
    const intensityVal = document.getElementById('vj-intensity-val');
    const tParticles = document.getElementById('toggle-particles');
    const tNoise = document.getElementById('toggle-noise');
    const tCrowd = document.getElementById('toggle-crowd');
    const cameraMode = document.getElementById('camera-mode');
    const shake = document.getElementById('shake-intensity');
    const shakeVal = document.getElementById('shake-val');

    screen.addEventListener('change', () => { state.vj.screenMode = screen.value; });
    light.addEventListener('change', () => { state.vj.lightMode = light.value; });
    intensity.addEventListener('input', () => {
      state.vj.lightIntensity = intensity.value / 100;
      intensityVal.textContent = `${intensity.value}%`;
    });
    tParticles.addEventListener('change', () => { state.vj.particlesOn = tParticles.checked; });
    tNoise.addEventListener('change', () => { state.vj.noiseOn = tNoise.checked; });
    tCrowd.addEventListener('change', () => { state.vj.crowdOn = tCrowd.checked; });

    cameraMode.addEventListener('change', () => { state.vj.cameraMode = cameraMode.value; });
    shake.addEventListener('input', () => {
      state.vj.shakeIntensity = shake.value / 100;
      shakeVal.textContent = `${shake.value}%`;
    });
  }
}
