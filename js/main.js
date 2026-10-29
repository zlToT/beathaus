// ============================================================
// main.js — 应用入口：初始化、文件导入、段落检测、主循环联动
// ============================================================

import { state } from './state.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { StageScene } from './stage/StageScene.js';
import { DeckPanel, fmtTime } from './ui/DeckPanel.js';
import { MixerPanel } from './ui/MixerPanel.js';
import { VJPanel } from './ui/VJPanel.js';
import { InfoPanel } from './ui/InfoPanel.js';
import { ColorPicker } from './ui/ColorPicker.js';
import { initTooltip } from './ui/Tooltip.js';

// ---------- 初始化 ----------
const engine = new AudioEngine();
engine.init();
// 同步初始参数到音频节点
engine.deckA.setVolume(state.deckA.volume);
engine.deckB.setVolume(state.deckB.volume);
engine.deckA.setFilter(0.5);
engine.deckB.setFilter(0.5);

const stage = new StageScene(document.getElementById('stage-container'));
stage.setPrimaryColor(state.vj.primaryColor);

const deckPanelA = new DeckPanel('A', engine);
const deckPanelB = new DeckPanel('B', engine);
const mixerPanel = new MixerPanel(engine);
new VJPanel();
const infoPanel = new InfoPanel();
new ColorPicker((hex) => stage.setPrimaryColor(hex));
initTooltip();

// ---------- 控制面板收起 / 展开（箭头跟随） ----------
const bottomDock = document.getElementById('bottom-dock');
const panelIcon = document.getElementById('panel-toggle-icon');
document.getElementById('panel-toggle').addEventListener('click', () => {
  const collapsed = bottomDock.classList.toggle('collapsed');
  panelIcon.textContent = collapsed ? '▲' : '▼';
  // 收起时同时隐藏顶部栏（当前曲目/实时信息）与右侧颜色拾取器
  document.body.classList.toggle('panel-collapsed', collapsed);
});

// ---------- 文件导入 ----------
const fileInput = document.getElementById('file-input');
let importTarget = null;

document.getElementById('global-import').addEventListener('click', () => {
  importTarget = null;
  fileInput.click();
});
document.querySelectorAll('.deck-import-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    importTarget = e.target.closest('[data-deck]').dataset.deck;
    fileInput.click();
  });
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    loadTrack(importTarget || autoPick(), fileInput.files[0]);
  }
  fileInput.value = '';
});

function autoPick() {
  if (!state.deckA.loaded) return 'A';
  if (!state.deckB.loaded) return 'B';
  return 'A'; // 两路都占用时替换 A
}

async function loadTrack(which, file) {
  await engine.resume();
  const deck = which === 'A' ? engine.deckA : engine.deckB;
  const ds = which === 'A' ? state.deckA : state.deckB;
  const elName = document.getElementById(`deck${which}-name`);
  elName.textContent = '加载中…';
  try {
    const info = await deck.load(file);
    ds.loaded = true;
    ds.name = info.name;
    ds.duration = info.duration;
    ds.bpm = info.bpm;
    elName.textContent = info.name;
    document.getElementById(`deck${which}-dur`).textContent = fmtTime(info.duration);
    document.getElementById(`deck${which}-bpm`).textContent = info.bpm ?? '--';
  } catch (e) {
    elName.textContent = '加载失败（格式不支持？）';
    console.error('音频加载失败：', e);
  }
}

// ---------- 拖拽上传 ----------
const overlay = document.getElementById('drop-overlay');
let dragDepth = 0;
const showOverlay = () => { overlay.classList.remove('hidden'); overlay.classList.add('flex'); };
const hideOverlay = () => { overlay.classList.add('hidden'); overlay.classList.remove('flex'); };

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  showOverlay();
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragDepth--;
  if (dragDepth <= 0) hideOverlay();
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  hideOverlay();
  const f = e.dataTransfer.files[0];
  if (!f) return;
  let target;
  if (e.clientX < window.innerWidth * 0.3) target = 'A';
  else if (e.clientX > window.innerWidth * 0.7) target = 'B';
  else target = autoPick();
  loadTrack(target, f);
});

// ---------- 段落检测（启发式） ----------
const bassHistory = [];
let currentSection = null;
let candidate = null;
let candidateSince = 0;

function detectSection(rawBass, position, t) {
  bassHistory.push({ t, v: rawBass });
  while (bassHistory.length && bassHistory[0].t < t - 30) bassHistory.shift();

  const avg = (from, to = 0) => {
    const arr = bassHistory.filter((x) => x.t >= t - from && x.t < t - to);
    return arr.length ? arr.reduce((s, x) => s + x.v, 0) / arr.length : null;
  };
  const short = avg(4);
  const long = avg(30) ?? short;
  const earlier = avg(4, 2) ?? short;

  let label;
  if (position > 0 && position < 15) label = 'Intro';
  else if (short > earlier * 1.12 && short >= long) label = 'Build';
  else if (long > 0 && short > long * 1.22) label = 'Drop';
  else if (long > 0 && short < long * 0.75) label = 'Break';
  else label = 'Groove';

  if (label !== currentSection) {
    if (label !== candidate) {
      candidate = label;
      candidateSince = t;
    } else if (t - candidateSince > 1.2) {
      currentSection = label;
      stage.sectionFX.onSection(label); // 段落确认切换 → 触发气球/彩带/光点
    }
  }
  return currentSection || label;
}

// ---------- 分析平滑 / 节拍 ----------
let smoothEnergy = 0;
let smoothBass = 0;
let lastPhase = 0;
let fakePulse = 0;
let lastFakeBeat = -10;

// ---------- 主循环 ----------
function loop() {
  requestAnimationFrame(loop);
  const t = performance.now() / 1000;
  engine.tick();
  // Cue 自动暂停（播放经过 Cue 点时停住）
  engine.deckA.checkCueAutoStop();
  engine.deckB.checkCueAutoStop();

  const a = engine.analyze();
  // 快攻击、慢释放（峰值保持），避免节拍间隙数值闪烁
  const targetEnergy = a.rawEnergy * 420;
  smoothEnergy = Math.max(targetEnergy, smoothEnergy * 0.95);
  const targetBass = a.rawBass * 100;
  smoothBass = Math.max(targetBass, smoothBass * 0.93);

  // 主导 Deck：优先选正在播放的；都播放 / 都没播放时按 Crossfader 位置
  const f = engine._f ?? 0.5;
  let domDeck;
  let domState;
  if (engine.deckA.isPlaying && !engine.deckB.isPlaying) {
    domDeck = engine.deckA; domState = state.deckA;
  } else if (engine.deckB.isPlaying && !engine.deckA.isPlaying) {
    domDeck = engine.deckB; domState = state.deckB;
  } else if (f < 0.5) {
    domDeck = engine.deckA; domState = state.deckA;
  } else {
    domDeck = engine.deckB; domState = state.deckB;
  }
  const bpm = domDeck.bpm;
  const position = domDeck.getPosition();

  // 节拍脉冲
  let beatPulse;
  if (bpm) {
    const phase = (t * bpm / 60) % 1;
    beatPulse = Math.pow(1 - phase, 2.6);
    lastPhase = phase;
  } else {
    if (a.rawBass > 0.45 && t - lastFakeBeat > 0.35) {
      lastFakeBeat = t;
      fakePulse = 1;
    }
    fakePulse *= 0.9;
    beatPulse = fakePulse;
  }

  const section = detectSection(a.rawBass, position, t);

  // 顶部当前曲目
  document.getElementById('now-playing').textContent =
    domState.loaded ? domState.name : '未加载曲目';

  const analysis = {
    energy: smoothEnergy,
    bass: Math.min(1, smoothBass / 100),
    bpm,
    section,
    beatPulse,
    freq: a.freq,
    wave: a.wave
  };
  Object.assign(state.analysis, analysis);

  stage.update(analysis, state.vj, t);
  infoPanel.update(analysis);
  deckPanelA.update(state.vj.primaryColor);
  deckPanelB.update(state.vj.primaryColor);
  mixerPanel.sync();
}

requestAnimationFrame(loop);
