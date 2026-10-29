// ============================================================
// DeckPanel — 单路 Deck 面板：控件绑定 + Canvas 搓碟转盘
// ============================================================

export function fmtTime(t) {
  if (!isFinite(t) || t < 0) return '00:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 33⅓ rpm 碟片基准角速度（rad/s）
const PLATTER_OMEGA = (33.333 / 60) * Math.PI * 2; // ≈ 3.49

export class DeckPanel {
  constructor(which, engine) {
    this.which = which;
    this.engine = engine;
    this.deck = which === 'A' ? engine.deckA : engine.deckB;
    const g = (id) => document.getElementById(`deck${which}-${id}`);
    this.elName = g('name');
    this.elCur = g('cur');
    this.elDur = g('dur');
    this.elProgress = g('progress');
    this.cueLayer = g('cue-layer');
    this.elBpm = g('bpm');
    this.elVolume = g('volume');
    this.playBtn = g('play');
    this.cueBtn = g('cue');
    this.canvas = g('turntable');
    this.ctx = this.canvas.getContext('2d');
    this.angle = 0;
    this._lastT = performance.now();
    this._dragging = false;
    this._smoothRate = 0;
    this._lastMoveTime = 0;
    this._bindControls();
    this._bindKnob();
    this._bindTurntable();
  }

  _bindControls() {
    this.playBtn.addEventListener('click', async () => {
      await this.engine.resume();
      this.deck.togglePlay();
    });
    this.cueBtn.addEventListener('click', async () => {
      await this.engine.resume();
      this.deck.addCue();
      this.cueLayer.dataset.key = 'FORCE'; // 强制重绘（不能用 ''，会与空列表冲突）
    });
    this.elVolume.addEventListener('input', () => {
      this.deck.setVolume(this.elVolume.value / 100);
    });

    // 进度 seek
    const track = this.elProgress.parentElement;
    const seekTo = (clientX) => {
      const r = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      this.deck.seek(ratio * this.deck.buffer.duration);
    };
    let down = false;
    track.addEventListener('pointerdown', (e) => {
      if (!this.deck.buffer) return;
      // 点在 Cue 标签上则不 seek（标签自己处理删除）
      if (e.target.classList.contains('cue-tag')) return;
      down = true;
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件无活跃指针 */ }
      seekTo(e.clientX);
    });
    track.addEventListener('pointermove', (e) => {
      if (down) seekTo(e.clientX);
    });
    track.addEventListener('pointerup', () => { down = false; });
  }

  // Filter 旋钮
  _bindKnob() {
    this.knob = document.querySelector(`.knob[data-knob="${this.which}"]`);
    this.knob.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startV = parseFloat(this.knob.dataset.value);
      const move = (ev) => {
        const v = Math.min(1, Math.max(0, startV - (ev.clientY - startY) / 180));
        this.knob.dataset.value = v;
        this.knob.querySelector('.knob-indicator').style.transform =
          `rotate(${-135 + v * 270}deg)`;
        this.deck.setFilter(v);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  // 搓碟转盘：物理跟随（手势角速度 → 播放速率，可倒放）
  _bindTurntable() {
    const c = this.canvas;
    const pointerAngle = (e) => {
      const r = c.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    let lastA = 0;
    let lastT = 0;

    c.addEventListener('pointerdown', async (e) => {
      if (!this.deck.buffer) return;
      await this.engine.resume();
      this.deck.scratchBegin();
      this._dragging = true;
      c.setPointerCapture(e.pointerId);
      lastA = pointerAngle(e);
      lastT = performance.now();
      this._lastMoveTime = lastT;
      this._smoothRate = this.deck._wasPlaying ? 1 : 0;
      c.style.cursor = 'grabbing';
    });

    c.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const a = pointerAngle(e);
      let d = a - lastA;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      // 单帧角度限幅：防止一次大跳造成速率尖峰（鬼叫）
      d = Math.max(-0.5, Math.min(0.5, d));
      this.angle += d; // 视觉：碟片随手转
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.008, (now - lastT) / 1000));
      lastA = a;
      lastT = now;
      this._lastMoveTime = now;
      // 物理速率：手势角速度 / 碟片基准角速度
      const omega = d / dt;
      const target = omega / PLATTER_OMEGA;
      // 更柔和的平滑：跟手但不炸
      this._smoothRate += (target - this._smoothRate) * 0.35;
      this.deck.setScratchRate(this._smoothRate);
    });

    const end = () => {
      if (!this._dragging) return;
      this._dragging = false;
      c.style.cursor = 'grab';
      this.deck.scratchEnd();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  // 每帧更新
  update(primaryColor) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastT) / 1000);
    this._lastT = now;

    const pos = this.deck.getPosition();
    const dur = this.deck.buffer ? this.deck.buffer.duration : 0;
    const ratio = dur ? pos / dur : 0;

    this.elProgress.style.width = `${ratio * 100}%`;
    this.elCur.textContent = fmtTime(pos);
    if (this.deck.buffer) this.elDur.textContent = fmtTime(dur);

    // 播放按钮文字（搓碟临时出声时不显示"暂停"）
    const reallyPlaying = this.deck.isPlaying && !this.deck._scratching;
    this.playBtn.textContent = reallyPlaying ? '暂停' : '播放';
    this.playBtn.classList.toggle('active', this.deck.isPlaying);

    // 搓碟中手停住（约 80ms 无 move）→ 速率平滑到 0
    if (this._dragging && now - this._lastMoveTime > 80) {
      this._smoothRate += (0 - this._smoothRate) * 0.25;
      this.deck.setScratchRate(this._smoothRate);
    }

    // 自动旋转（非搓碟拖拽）：跟随当前播放速率
    if (this.deck.isPlaying && !this._dragging) {
      const rate = this.deck.source ? this.deck.source.playbackRate.value : 1;
      this.angle += dt * PLATTER_OMEGA * rate;
    }

    this._renderCues(dur);
    this._drawTurntable(ratio, primaryColor);
  }

  // 多 Cue 标签：同步数量与位置，点击删除
  _renderCues(dur) {
    const layer = this.cueLayer;
    const cues = this.deck.cuePoints;
    const key = cues.map((c) => c.toFixed(2)).join(',');
    if (layer.dataset.key === key) return;
    layer.dataset.key = key;
    layer.innerHTML = '';
    if (!dur) return;
    cues.forEach((c) => {
      const tag = document.createElement('div');
      tag.className = 'cue-tag';
      tag.style.left = `${(c / dur) * 100}%`;
      tag.title = `Cue ${fmtTime(c)} · 点击删除`;
      // 阻止进度条 seek
      tag.addEventListener('pointerdown', (e) => e.stopPropagation());
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deck.removeCueAt(c);
        layer.dataset.key = 'FORCE';
      });
      layer.appendChild(tag);
    });
  }

  _drawTurntable(ratio, primary) {
    const ctx = this.ctx;
    const cx = 59;
    const cy = 59;
    ctx.clearRect(0, 0, 118, 118);

    // 外圈底
    const base = ctx.createRadialGradient(cx, cy, 20, cx, cy, 58);
    base.addColorStop(0, '#1c1038');
    base.addColorStop(1, '#0a0616');
    ctx.beginPath();
    ctx.arc(cx, cy, 56, 0, Math.PI * 2);
    ctx.fillStyle = base;
    ctx.fill();

    // 刻度（随转盘旋转）
    for (let i = 0; i < 72; i++) {
      const a = this.angle + (i * Math.PI * 2) / 72;
      const long = i % 6 === 0;
      const r0 = long ? 49 : 52;
      ctx.beginPath();
      ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
      ctx.lineTo(cx + 55 * Math.cos(a), cy + 55 * Math.sin(a));
      ctx.strokeStyle = long ? `${primary}cc` : `${primary}55`;
      ctx.lineWidth = long ? 1.6 : 1;
      ctx.stroke();
    }

    // 进度弧
    if (ratio > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, 46, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
      ctx.strokeStyle = primary;
      ctx.lineWidth = 3;
      ctx.shadowColor = primary;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 碟面
    const disc = ctx.createRadialGradient(cx, cy, 4, cx, cy, 40);
    disc.addColorStop(0, '#281850');
    disc.addColorStop(1, '#120a26');
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = disc;
    ctx.fill();
    [26, 33].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 中心轴
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = primary;
    ctx.shadowColor = primary;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 中心标签
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 9px Consolas';
    ctx.textAlign = 'center';
    ctx.fillText(this.which, cx, cy + 19);

    // 唱针（固定，从右上伸向碟面）
    ctx.beginPath();
    ctx.moveTo(100, 14);
    ctx.lineTo(76, 40);
    ctx.strokeStyle = 'rgba(220,210,255,0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(100, 14, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#cfc4f0';
    ctx.fill();
  }
}
