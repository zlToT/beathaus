# BeatHaus · LiveHouse 演唱会模拟器

网页版 LiveHouse 打碟模拟器。纯前端单页面应用，导入本地音频即可在虚拟演唱会现场打碟——音频实时分析驱动大屏、灯光、粒子、人形观众、能量面板与 VJ 视觉联动。

- 技术栈：**Three.js + Tailwind CSS + Web Audio API**（全部 CDN / 原生，无构建步骤）
- 无后端、无 npm 依赖，静态文件直接运行
- 部署：GitHub Pages

## 功能

- **双音轨 Deck A / Deck B**：最多导入 2 首本地音频（mp3 / flac）
  - 播放 / 暂停（一键复用，文字随状态切换）
  - **多 Cue 点**：可打多个，进度条上为可点击标签（点击删除），播放正向越过 Cue 自动暂停
  - 进度条 seek、音量滑块、BPM 自动检测
  - **搓碟转盘**：按真实碟片物理速度跟随，支持倒放、手停声停、暂停时搓碟临时出声
  - 每 Deck Filter 旋钮（低通 / 高通）
- **混音控制台**：Crossfader 交叉推子（等功率曲线）、高频 / 低频 Filter、总音量、MIX-A / MIX-B 一键自动渐变切换
- **3D 演唱会现场**：
  - 主舞台 + 延伸 T 台、主大屏 + 两侧副屏、线阵列吊挂音箱、桁架
  - 可调色灯光与光束、粒子效果
  - **人形观众**（130 人，手持荧光棒或手机，随节拍跳动挥手）
  - 舞台机器人 VJ
- **实时信息面板**：ENERGY 能量值、BASS 值、BPM、段落标签（Intro / Build / Drop / Break / Groove，自动检测）
- **VJ 视觉控制**：
  - 大屏视觉（螺旋 / 波形 / 频谱 / 隧道）、灯光模式（静态 / 节拍脉冲 / 扫射 / 彩虹循环）、灯光强度
  - 粒子开关、干涉噪点开关、观众开关
  - **镜头模式**（静止 / 轻微环绕 / 节拍推进 / 全景俯视）
  - **屏幕震动**强度（随 BASS 叠加）
  - 主色调拾取器（全局联动）
- 所有行话标签带悬浮提示；支持拖拽音频上传或点击导入，所有滑块、旋钮实时生效

## 本地运行

推荐用静态服务器（ES Module 在 `file://` 下会受限）：

```powershell
# 任选其一
python -m http.server 8080
npx serve .
```

然后浏览器打开 `http://localhost:8080`。

## 操作说明

1. 点击中间「导入音频文件」，或直接把音频文件拖进窗口（拖到左侧 / 右侧可指定 Deck A / Deck B）
2. 用「播放 / 暂停」控制曲目，进度条可点击跳转；点「Cue」打点，点进度条上的 Cue 标签可删除
3. 按住转盘搓碟（可正反转），拖动 Crossfader 混音，或点 MIX-A / MIX-B 自动切换
4. 用右侧颜色拾取器修改主色调，大屏、灯光、粒子、观众、UI 会整体变色
5. 用 VJ 控制区切换大屏视觉、灯光、镜头、震动与氛围开关

## 浏览器兼容

- 推荐 **Chrome / Edge**（Chromium 系）：`decodeAudioData` 支持 FLAC、搓碟支持负 playbackRate 倒放
- Firefox / Safari 对 FLAC 支持有限，建议使用 mp3
- 桌面端适配（窄屏下控制面板横向滚动）

## 目录结构

```
├── index.html          # 单页面入口
├── css/style.css       # 霓虹风样式
├── docs/               # MVP_DESIGN 设计文档 / DEVELOPMENT_REPORT 开发报告 / OPTIMIZATION_LOG 优化记录
└── js/
    ├── main.js         # 入口 / 主循环 / 文件导入
    ├── state.js        # 全局状态
    ├── audio/          # AudioEngine / Deck / BPMDetector / AudioAnalyser
    ├── stage/          # StageScene / 大屏 / 灯光 / 粒子 / 观众 / 机器人
    └── ui/             # Deck / Mixer / VJ / Info / ColorPicker 面板
```

## 说明

- BPM 为浏览器端离线估算（低频 onset + 自相关），个别曲目可能存在偏差
- 段落标签为启发式能量分析结果，仅作氛围展示
- 音频文件仅在本地浏览器中处理，不会上传到任何服务器
