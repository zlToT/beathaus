// ============================================================
// MixerPanel — 混音台：Crossfader / MIX 自动切换 / EQ / 总音量
// ============================================================

export class MixerPanel {
  constructor(engine) {
    this.engine = engine;
    this.cross = document.getElementById('crossfader');
    this.mixA = document.getElementById('mix-a');
    this.mixB = document.getElementById('mix-b');
    this.eqHigh = document.getElementById('eq-high');
    this.eqLow = document.getElementById('eq-low');
    this.master = document.getElementById('master-volume');
    this.eqHighVal = document.getElementById('eq-high-val');
    this.eqLowVal = document.getElementById('eq-low-val');
    this.masterVal = document.getElementById('master-val');

    this.cross.addEventListener('input', () => {
      engine.setCrossfader(this.cross.value / 100);
      this.mixA.classList.remove('active');
      this.mixB.classList.remove('active');
    });
    this.mixA.addEventListener('click', () => {
      engine.moveCrossfaderTo(0);
      this.mixA.classList.add('active');
      this.mixB.classList.remove('active');
    });
    this.mixB.addEventListener('click', () => {
      engine.moveCrossfaderTo(1);
      this.mixB.classList.add('active');
      this.mixA.classList.remove('active');
    });

    this.eqHigh.addEventListener('input', () => {
      const v = parseFloat(this.eqHigh.value);
      engine.setHighEq(v);
      this.eqHighVal.textContent = `${v > 0 ? '+' : ''}${v}dB`;
    });
    this.eqLow.addEventListener('input', () => {
      const v = parseFloat(this.eqLow.value);
      engine.setLowEq(v);
      this.eqLowVal.textContent = `${v > 0 ? '+' : ''}${v}dB`;
    });
    this.master.addEventListener('input', () => {
      const v = this.master.value;
      engine.setMasterVolume(v / 100);
      this.masterVal.textContent = `${v}%`;
    });
  }

  // 每帧同步：自动渐变时滑块跟随；到位后高亮对应 MIX 按钮
  sync() {
    const f = this.engine._f ?? 0.5;
    if (this.engine._anim) {
      this.cross.value = Math.round(f * 100);
    } else {
      if (f <= 0.02) {
        this.mixA.classList.add('active');
        this.mixB.classList.remove('active');
      } else if (f >= 0.98) {
        this.mixB.classList.add('active');
        this.mixA.classList.remove('active');
      }
    }
  }
}
