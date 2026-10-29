// ============================================================
// 全局状态（单例 store）+ 简单发布订阅
// ============================================================

function createDeckState() {
  return {
    loaded: false,
    file: null,
    name: '',
    duration: 0,
    bpm: null,
    isPlaying: false,
    volume: 0.8,
    cuePoints: [],        // 多 Cue（秒）
    position: 0,
    filter: 0.5,          // 0..1，0.5 为直通
    turntableAngle: 0     // 转盘角度（弧度）
  };
}

export const state = {
  deckA: createDeckState(),
  deckB: createDeckState(),
  mixer: {
    crossfader: 0.5,      // 0 = 全 A，1 = 全 B
    highEq: 0,
    lowEq: 0,
    masterVolume: 0.8,
    mixSide: null         // 'A' | 'B' | null
  },
  vj: {
    screenMode: 'wave',
    lightMode: 'pulse',
    lightIntensity: 0.5,
    particlesOn: true,
    noiseOn: true,
    crowdOn: true,
    primaryColor: '#9b5cff',
    cameraMode: 'static',   // static / orbit / beat / overview
    shakeIntensity: 0.1     // 0..1
  },
  // 每帧由音频引擎写入
  analysis: {
    energy: 0,
    bass: 0,
    bpm: null,
    section: '--',
    beat: false,
    beatPulse: 0,
    freq: null,
    wave: null
  }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(scope) {
  listeners.forEach((fn) => {
    try { fn(scope); } catch (e) { console.error(e); }
  });
}
