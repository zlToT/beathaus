# BeatHaus · LiveHouse 演唱会模拟器 — MVP 设计文档

> 项目名：**beathaus**
> 形态：纯前端单页面 Web 应用，无后端，本地直接运行
> 部署：GitHub 仓库 `livehouse-dj`，开启 GitHub Pages（根目录部署）
> 文档版本：v0.1（MVP 设计稿，写代码前确认用）

---

## 1. 项目概述

在浏览器中模拟一个 LiveHouse 演出现场：用户导入本地音频文件（最多 2 首），通过双 Deck 打碟台进行播放、Cue、搓碟、混音操作；同时由 Three.js 渲染一个 3D 虚拟 LiveHouse 舞台（大屏、灯光、光束、粒子、观众、机器人 VJ），音频实时分析数据（音量、低频能量、BPM、段落）驱动灯光、粒子、能量面板与 VJ 视觉联动。

### 1.1 MVP 目标

- 可导入 2 首本地音频（mp3 / flac），分别加载到 Deck A / Deck B
- 双 Deck 基础打碟功能：播放/暂停、Cue、进度 seek、音量、BPM 显示、搓碟转盘可视化
- 混音台：Crossfader、高/低频 Filter、总音量、MIX 一键切换
- 3D 舞台：大屏、可调色灯光、光束、粒子、观众小人、3 个机器人 VJ
- 实时信息面板：ENERGY / BASS / BPM / SECTION（Drop/Build/Break 等）
- VJ 控制区：VJ 模式、灯光模式、灯光强度、粒子开关、干涉噪点开关、主色调拾取器
- 音频分析实时驱动视觉联动；离线自动检测 BPM
- 支持拖拽上传与点击导入；所有控件实时生效
- 界面中文，深色赛博暗紫霓虹风，布局与参考截图一致

### 1.2 非目标（MVP 不做，列入后续迭代）

- 录音 / 录制混音输出、音频导出
- 自动对拍（Sync）、Keylock、变速不变调
- Hot Cue 多点、循环（Loop）、采样器（Sampler）、效果器链（Echo/Reverb 等）
- 多场景切换、自定义模型导入、第一人称漫游
- 移动端适配（MVP 仅桌面端 Chrome / Edge）
- 在线曲库、云端保存、用户账号

---

## 2. 技术栈


| 类别    | 选型                                       | 说明                                     |
| ------- | ------------------------------------------ | ---------------------------------------- |
| 3D 渲染 | **Three.js**（ES Module，CDN + importmap） | 舞台、灯光、粒子、机器人、观众           |
| UI      | **Tailwind CSS**（CDN 方式）               | 控制面板布局、霓虹风样式                 |
| 音频    | **Web Audio API**（原生）                  | 解码、播放路由、滤波、FFT 分析、BPM 检测 |
| 后处理  | 自定义 ShaderPass / CSS 噪点               | 干涉噪点、辉光（Bloom 可选）             |
| 其他    | 原生 HTML/CSS/JS（ES Modules）             | 无构建步骤，无 npm 依赖                  |
| 部署    | GitHub Pages（根目录）                     | 所有资源使用相对路径`./`                 |

> 不使用打包器：双击 `index.html` 或用任意静态服务器（如 `npx serve`）即可运行。
> 注意：ES Module + 本地文件在部分浏览器下受 `file://` 限制，README 中说明推荐用静态服务器打开；GitHub Pages 无此问题。

---

## 3. 目录结构

```
livehouse-dj/
├── index.html                # 单页面入口：3D 画布 + 控制面板 + 颜色拾取器
├── README.md                 # 项目说明、运行方式、功能与操作指引
├── .gitignore
├── docs/
│   └── MVP_DESIGN.md         # 本文档
├── css/
│   └── style.css             # 霓虹风自定义样式（Tailwind 之外的补充）
└── js/
    ├── main.js               # 应用入口：初始化各模块、主循环、全局状态
    ├── state.js              # 全局状态（单例 store）：deck 状态、VJ 参数、颜色
    ├── audio/
    │   ├── AudioEngine.js    # AudioContext、信号路由、master 分析
    │   ├── Deck.js           # 单路 Deck：播放/暂停/Cue/seek/音量/滤波/搓碟
    │   ├── BPMDetector.js    # 离线 BPM 检测（低频 onset + 自相关）
    │   └── AudioAnalyser.js  # FFT/时域数据提取：RMS、BASS、频段能量
    ├── stage/
    │   ├── StageScene.js     # Three.js 场景/相机/渲染循环/后处理
    │   ├── StageScreen.js    # 舞台大屏：CanvasTexture 动态 VJ 视觉
    │   ├── Lights.js         # 聚光灯/光束/环境光，灯光模式与颜色
    │   ├── Particles.js      # 粒子系统（BASS 爆发）
    │   ├── Crowd.js          # 台下观众小人（InstancedMesh，节拍跳动）
    │   └── RobotVJ.js        # 舞台机器人 VJ 形象（3 个，节拍动画）
    └── ui/
        ├── DeckPanel.js      # 双 Deck 面板绑定
        ├── MixerPanel.js     # 混音台：Crossfader / Filter / 总音量 / MIX
        ├── VJPanel.js        # VJ 控制区
        ├── InfoPanel.js      # 右上角实时信息面板
        └── ColorPicker.js    # 右侧颜色拾取器（原生 color input + RGB）
```

---

## 4. 页面布局

整体为**全屏单页**，z 轴分层：

```
┌──────────────────────────────────────────────────────────────┐
│ 顶部栏（半透明）                                                │
│ 左上：Logo「easy dj」+ 当前曲目名                                │
│                              右上：实时信息面板（悬浮卡片）       │
│                              ENERGY │ BASS │ BPM │ SECTION     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│            3D LiveHouse 舞台画布（Three.js 全屏背景）           │
│        舞台大屏 / 光束 / 机器人 VJ / 粒子 / 观众剪影            │
│                                                              │
│                                              ┌─────────────┐ │
│                                              │ 颜色拾取器   │ │
│                                              │（右侧悬浮）  │ │
│                                              └─────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ 下方 DJ 控制面板（悬浮，半透明深色玻璃拟态，底部对齐）           │
│ ┌──────────┬──────────────────────────────┬──────────┐       │
│ │ Deck A   │ 混音台（Crossfader/Filter/   │ Deck B   │       │
│ │ 转盘/控件 │ 总音量/MIX/VJ 控制区）        │ 转盘/控件 │       │
│ └──────────┴──────────────────────────────┴──────────┘       │
└──────────────────────────────────────────────────────────────┘
```

- 上方：3D 舞台画布占满视口背景
- 下方：DJ 控制面板悬浮于画布底部，宽度约 90%，居中
- 右侧：颜色拾取器悬浮（默认展开，可折叠）
- 顶部：左上 Logo 与曲目，右上实时信息面板
- 拖拽音频文件到窗口任意位置时，全屏显示霓虹虚线拖放遮罩

---

## 5. 功能模块设计

### 5.1 双 Deck（Deck A / Deck B）

每路 Deck 独立，包含：


| 控件        | 行为                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 导入区      | 点击打开文件选择器（accept:`audio/*,.flac,.mp3`），或拖拽文件到该 Deck 区域；加载后显示文件名、总时长                               |
| Play / Cue  | **播放/暂停**：保留当前位置；**Cue**：暂停时按 Cue 在当前位置设置 Cue 点；播放中按 Cue 回到 Cue 点并暂停（标准 DJ 逻辑）            |
| 进度条      | 显示当前播放位置（时间`mm:ss / mm:ss`），**点击/拖拽进度条可 seek**                                                                 |
| 音量滑块    | 0–100%，控制该 Deck GainNode，实时生效                                                                                             |
| BPM 显示    | 音频加载后离线检测，显示整数 BPM；未加载显示`--`                                                                                    |
| 搓碟转盘    | Canvas 绘制：霓虹外环、刻度、碟面、唱针；播放时按速率旋转；**鼠标按下拖拽转盘**产生临时变速（pitch bend / scrub），松开恢复正常转速 |
| Filter 旋钮 | 每 Deck 一个低通/高通滤波旋钮（默认 12 点位置为无效果，向左低通、向右高通）                                                         |

**播放状态管理**：`AudioBufferSourceNode` 为一次性节点，每次播放重新创建。Deck 维护：

- `startOffset`（已播放秒数）
- `ctxStartTime`（本次 start 的 AudioContext 时间）
- `paused` / `isPlaying`
- seek、Cue 时停止旧 source 并按需重建

### 5.2 混音控制台（Mixer）


| 控件                | 行为                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Crossfader 交叉推子 | 水平滑块，中间为两路等音量；左右两端分别只听 A / B；采用**等功率曲线**（`gainA = cos(θ)`、`gainB = sin(θ)`），避免中间位置音量凹陷 |
| 高频 Filter         | 旋钮 / 滑块，控制 highshelf 增益（±12dB）                                                                                           |
| 低频 Filter         | 旋钮 / 滑块，控制 lowshelf 增益（±12dB）                                                                                            |
| 总音量              | 0–100%，控制 MasterGain                                                                                                             |
| MIX 切换按钮        | **MIX-A / MIX-B**：点击后 Crossfader 在约 1 秒内自动平滑滑动到对应 Deck（自动渐变切换），按钮高亮当前侧；也可手动推 Crossfader 覆盖  |

### 5.3 3D 虚拟 LiveHouse 舞台

场景元素（暗紫雾效 + 低环境光）：

1. **舞台大屏**：舞台中央巨型 LED 屏（`PlaneGeometry` + `CanvasTexture`，每帧更新），显示 VJ 视觉，随 FFT 频谱与 BASS 变化
2. **舞台灯光**：多盏 SpotLight（顶部 / 两侧），颜色由主色调拾取器控制；灯光模式决定运动方式
3. **光束**：SpotLight 位置下方放置半透明圆锥体（Beam mesh），配合亮度与 BASS 做明暗/扫动
4. **粒子效果**：舞台上方/观众区 `Points` 粒子漂浮，BASS 命中时向上爆发、加速、变色
5. **台下观众小人**：`InstancedMesh` 简模小人（圆柱身体 + 球头），暗色剪影、手臂可简化为细盒；随节拍上下跳动、左右摇摆，BASS 越强幅度越大
6. **舞台机器人 VJ**：大屏前 3 个简易机器人（盒身、方头、发光双眼、天线、摆动双臂），随节拍做头部转动、手臂摆动、轻微弹跳；眼睛颜色随主色调

### 5.4 实时信息面板（右上角）


| 指标        | 来源                                     | 说明                                                           |
| ----------- | ---------------------------------------- | -------------------------------------------------------------- |
| **ENERGY**  | master 全频段 RMS                        | 归一化映射到百分比，强信号可超过 100%（如截图 148%），平滑插值 |
| **BASS**    | master FFT 低频（约 20–150 Hz）平均能量 | 0–100%，平滑插值                                              |
| **BPM**     | 当前主推 Deck 的 BPM                     | 跟随 Crossfader 位置选择主导 Deck；无音频显示`--`              |
| **SECTION** | 段落检测算法                             | `Intro / Build / Drop / Break / Groove` 标签                   |

**SECTION 段落检测（MVP 规则法）**：

- 维护低频能量 E 的短窗（约 4s）均值与长窗（约 30s）均值
- 短窗能量持续上升且斜率超阈值 → **Build**
- 短窗能量 > 长窗 × 1.3 且持续 → **Drop**
- 短窗能量 < 长窗 × 0.7 → **Break**
- 其余 → **Groove**；曲目开头 15s 内标记 **Intro**
- 该算法为启发式近似，不追求与真实曲目标注一致

### 5.5 VJ 视觉控制区


| 控件                | 选项 / 行为                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| VJ 模式（大屏视觉） | 下拉：**螺旋 Spiral**（截图默认红色螺旋）、**波形 Wave**、**频谱 Bars**、**粒子隧道 Tunnel**                         |
| 灯光模式            | **静态**、**节拍脉冲**（随 BASS 明暗）、**扫射**（光束随节拍左右摆动）、**彩虹循环**（色相自动流转，此时忽略主色调） |
| 灯光强度            | 滑块 0–100%，缩放灯光亮度与光束不透明度                                                                             |
| 粒子开关            | 开 / 关                                                                                                              |
| 干涉噪点            | 开 / 关：大屏画面叠加噪点/扫描线/干涉条纹（shader 或 canvas 噪声），开启后增强故障艺术感                             |
| 颜色拾取器          | 右侧悬浮：原生色板 + 色相环 + RGB 数值输入；修改**主色调**，联动灯光、光束、粒子、机器人眼睛、UI 强调色              |

---

## 6. 音频引擎设计

### 6.1 信号路由

```
Deck A: BufferSource → DeckGainA → DeckFilterA(lowpass/highpass) ─┐
                                                                 ├→ CrossfadeGainA ─┐
Deck B: BufferSource → DeckGainB → DeckFilterB ─────────────────┼→ CrossfadeGainB ─┤
                                                                 │                  ├→ MixFilter(highshelf)
                                                                 │                  ├→ MixFilter(lowshelf)
                                                                 │                  ├→ MasterGain
                                                                 │                  ├→ MasterAnalyser(FFT)
                                                                 │                  └→ destination（扬声器）
                                                                 └→ DeckAnalyserA / B（各 Deck 分析）
```

- 所有 Gain / Filter 参数变化使用 `setTargetAtTime` 平滑，避免爆音
- MasterAnalyser：`fftSize = 2048`，用于全局 FFT 与波形；另设 DeckAnalyser 用于各自能量
- 首次交互（点击导入/播放）时才 `resume()` AudioContext，满足浏览器自动播放策略

### 6.2 音频分析（AudioAnalyser）

每帧（requestAnimationFrame）：

- `getByteFrequencyData`：按频段聚合 —— 低频（20–150Hz）、中频、高频
- `getByteTimeDomainData`：计算 RMS 总能量
- 输出归一化数值：`bass`（0–1）、`level`（0–1+）、频段数组（供大屏频谱）
- 数值做指数平滑（如 `v = v*0.7 + raw*0.3`），避免灯光闪烁抖动

### 6.3 BPM 检测（BPMDetector，离线）

音频文件 `decodeAudioData` 后：

1. 取单声道（或左右平均），降采样/低通聚焦低频
2. 滑动窗口计算低频能量包络，检测 onset（局部峰值超阈值）
3. 对 onset 间隔做自相关 / 直方图统计，得到候选节拍间隔
4. 换算 BPM 并折叠到 80–160 区间（倍频/半频修正）
5. 输出整数 BPM；置信度低时回退到能量自相关结果，仍失败则显示 `--`

> FLAC：Chromium 系浏览器（Chrome/Edge）的 `decodeAudioData` 支持 FLAC 解码；Safari/Firefox 支持有限，README 中注明推荐 Chrome/Edge。

---

## 7. 视觉联动设计

主循环（约 60fps）顺序：

1. 读取 MasterAnalyser / DeckAnalyser 数据
2. 更新 InfoPanel（ENERGY / BASS / BPM / SECTION）
3. 更新 StageScreen（VJ 模式 + 频谱 + 噪点开关）
4. 按灯光模式更新灯光颜色/亮度/角度、光束
5. 更新粒子（BASS 爆发、开关、颜色）
6. 更新观众与机器人（节拍相位、BASS 幅度）
7. 搓碟转盘旋转（播放速率 + 拖拽 pitch bend）
8. 渲染 Three.js 场景

**联动映射**：

- BASS ↑ → 灯光变亮、光束扩张、粒子爆发、观众跳跃幅度、机器人动作幅度
- ENERGY ↑ → 大屏动画速度、粒子数量活跃度
- BPM → 节拍时钟（节拍间隔 = 60/BPM），驱动观众/机器人周期性动作
- 主色调 → 灯光/光束/粒子/机器人眼睛/UI 霓虹强调色统一替换

---

## 8. 状态管理（state.js）

单例 store，简单发布订阅：

```js
state = {
  deckA: { file, name, duration, bpm, isPlaying, volume, cuePoint,
           position, filterCutoff, filterType, turntableAngle, pitchBend },
  deckB: { ...同上 },
  mixer: { crossfader, highEq, lowEq, masterVolume, mixSide: 'A'|'B'|null },
  vj: { screenMode, lightMode, lightIntensity, particlesOn, noiseOn,
        primaryColor: '#9b5cff' },
  analysis: { energy, bass, bpm, section, frequencyData }
}
```

- UI 控件 → 写入 state → 音频引擎 / 3D 模块读取
- 分析数据每帧写入 state，UI 与场景消费
- 主色调变化通过 CSS 变量 `--primary` 同步到 UI 强调色

---

## 9. UI 风格规范

- **基调**：深色（近黑 `#0a0612` / `#12081f`）+ 赛博暗紫霓虹
- **主色**：霓虹紫 `#9b5cff`，辅助品红 `#ff4fd8`、青色 `#35e0ff`、警示橙 `#ff7a2f`
- **面板**：半透明深色玻璃拟态（`rgba(20,10,35,0.72)` + 背景模糊 + 1px 霓虹描边 + 外发光）
- **文字**：无衬线字体，标签小号大写/中文，数值用等宽数字字体，发光效果
- **滑块**：自定义 range 样式（细轨道 + 霓虹渐变填充 + 发光圆点）
- **旋钮**：环形刻度 + 发光指示线，拖拽旋转
- **按钮**：深色底 + 霓虹边框，激活态填充发光（如 MIX-A 橙色高亮）
- 参考截图：顶部信息卡片、底部长条控制面板、右侧颜色拾取器

---

## 10. 交互细节

- **导入方式**：
  1. 点击「导入音频文件」按钮 / 各 Deck 导入区 → 文件选择器
  2. 拖拽文件到窗口：单文件默认进 Deck A（A 已占用则进 B）；拖到指定 Deck 区域则进该 Deck
  3. 超过 2 首时提示「最多加载 2 首，请先替换某一 Deck」
- 加载中显示进度状态（decode 为异步），完成后刷新曲目名、时长、BPM
- **所有滑块/旋钮/开关**输入即实时生效（滤波、音量、灯光、颜色等）
- 颜色拾取器：色板点击 + 色相环 + RGB 三输入框，三者双向同步
- 拖放遮罩、按钮悬停、数值变化均带轻微过渡动画

---

## 11. 验收标准（MVP）

1. 浏览器打开 `index.html`（静态服务器）后，默认呈现 3D 舞台与完整控制面板，无控制台报错
2. 可通过点击或拖拽导入 2 首 mp3/flac，分别进入 Deck A/B，显示文件名、时长、BPM
3. 播放/暂停、Cue、进度 seek、音量、Filter 旋钮均正确生效且无爆音
4. 搓碟转盘随播放旋转，拖拽可产生变速/搓碟效果
5. Crossfader 等功率混音正常；MIX-A/MIX-B 可自动平滑切换
6. 舞台大屏、灯光、光束、粒子、观众、3 个机器人均正常渲染
7. ENERGY / BASS / BPM / SECTION 随音乐实时变化
8. VJ 模式、灯光模式、强度、粒子开关、噪点开关、主色调拾取均实时生效
9. 音频低频能量明显驱动灯光/粒子/观众/机器人联动
10. 推送到 GitHub 后 Pages 可正常访问，资源路径无 404
11. 界面中文，整体视觉与参考截图风格一致（暗紫霓虹、布局分区）

---

## 12. 里程碑与开发顺序

1. **M1 骨架**：index.html + Tailwind + 布局骨架（顶部栏、底部面板、右侧拾取器占位）
2. **M2 音频引擎**：AudioContext 路由、Deck 播放/暂停/Cue/seek/音量、文件导入（点击 + 拖拽）
3. **M3 分析**：FFT/RMS/BASS 提取、BPM 离线检测、信息面板数值联动
4. **M4 混音台**：Crossfader、EQ、Filter、总音量、MIX 自动切换
5. **M5 3D 舞台**：场景、大屏 VJ 视觉、灯光光束、粒子、观众、机器人
6. **M6 VJ 控制 + 颜色拾取**：模式/强度/开关/噪点、主色调全局联动
7. **M7 搓碟转盘**：Canvas 转盘绘制、旋转、拖拽变速
8. **M8 打磨与部署**：样式细节、README、本地验证、推送 GitHub、开启 Pages

---

## 13. 风险与对策


| 风险                        | 影响                   | 对策                                                |
| --------------------------- | ---------------------- | --------------------------------------------------- |
| 浏览器自动播放策略          | AudioContext 无法启动  | 首次用户交互后 resume，并提示点击开始               |
| FLAC 解码兼容性             | 部分浏览器无法加载     | 推荐 Chrome/Edge；加载失败给出明确中文提示          |
| BPM 检测不准（复杂曲目）    | BPM 数值偏差           | 倍频折叠 + 多策略回退；标注为估算值，不做硬联动依赖 |
| 大文件 decode 卡顿          | 导入时短暂卡死         | 异步 decode + 加载状态提示；不阻塞 UI               |
| `file://` 下 ES Module 受限 | 双击打开白屏           | README 推荐静态服务器；部署 Pages 不受影响          |
| 粒子/后处理性能             | 低端机掉帧             | 粒子数量与像素比可配置；后处理保持轻量              |
| 段落检测为启发式            | SECTION 与真实段落不符 | 仅作氛围展示，不影响核心功能；后续可接入更成熟算法  |

---

## 14. 部署方案（GitHub Pages）

- 本地仓库路径：`D:\Work\site\livehouse-dj`
- GitHub 新建仓库：`livehouse-dj`（Public）
- 推送后在仓库 **Settings → Pages → Source: Deploy from a branch (main / root)**
- 访问地址形如：`https://<用户名>.github.io/livehouse-dj/`
- 代码中所有资源引用使用相对路径（`./js/...`、`./css/...`），CDN 资源使用 https
- 遵循用户约定：**未经明确指示不执行 git commit**，由用户验证通过后再提交/推送
