# LiveHouse DJ 打碟模拟器 — 开发报告

> 项目名：**livehouse-dj**（easy dj · LiveHouse Sim）
> 报告日期：2026-10-29
> 文档版本：v1.0
> 形态：纯前端单页面 Web 应用（无后端、无构建步骤）

---

## 一、项目概况

在浏览器中模拟 LiveHouse 演出现场：用户导入最多 2 首本地音频（mp3 / flac），通过双 Deck 打碟台完成播放、Cue、搓碟、混音；同时由 Three.js 渲染 3D 虚拟舞台（大屏、灯光、光束、粒子、观众、机器人 VJ），Web Audio API 实时分析音频数据，驱动灯光、粒子、能量面板与 VJ 视觉联动。

- 技术栈：**Three.js + Tailwind CSS + Web Audio API**
- 依赖方式：Three.js CDN（importmap）、Tailwind Play CDN、原生 Web Audio
- 部署目标：GitHub Pages（根目录静态托管）

---

## 二、交付物

| 交付项 | 路径 | 状态 |
|---|---|---|
| 页面入口 | `index.html` | 已完成 |
| 样式 | `css/style.css` | 已完成 |
| 应用脚本 | `js/main.js`、`js/state.js` | 已完成 |
| 音频模块 | `js/audio/`（4 个模块） | 已完成 |
| 3D 舞台模块 | `js/stage/`（6 个模块） | 已完成 |
| UI 模块 | `js/ui/`（5 个模块） | 已完成 |
| 设计文档 | `docs/MVP_DESIGN.md` | 已完成 |
| 项目说明 | `README.md` | 已完成 |
| 测试音频 | `test_demo.wav`（124 BPM）、`test_demo2.wav`（110 BPM） | 已生成，gitignore 忽略 |

---

## 三、技术架构

### 3.1 总体分层

```
┌─────────────────────────────────────────────┐
│  UI 层（Tailwind + 自定义霓虹样式）            │
│  DeckPanel / MixerPanel / VJPanel /           │
│  InfoPanel / ColorPicker                      │
├─────────────────────────────────────────────┤
│  状态层 state.js（单例 store）                 │
├──────────────────────┬──────────────────────┤
│  音频层 Web Audio     │  渲染层 Three.js       │
│  AudioEngine / Deck / │  StageScene / 大屏 /   │
│  BPMDetector /       │  灯光 / 粒子 / 观众 /  │
│  AudioAnalyser       │  机器人               │
└──────────────────────┴──────────────────────┘
```

### 3.2 音频信号路由

```
Deck A: BufferSource → DeckGainA → DeckFilterA(lowpass/highpass) → CrossfadeGainA ─┐
Deck B: BufferSource → DeckGainB → DeckFilterB → CrossfadeGainB ────────────────┤
                                                                               ├→ lowshelf
                                                                               ├→ highshelf
                                                                               ├→ MasterGain
                                                                               ├→ MasterAnalyser(FFT)
                                                                               └→ destination
```

- 每 Deck 另设 Analyser 作为 tap 分析
- 所有参数变化使用 `setTargetAtTime` 平滑，避免爆音
- 首次用户交互后 `resume()` AudioContext，满足浏览器自动播放策略

### 3.3 主循环（约 60fps）

1. 读取 Master / Deck 分析数据（FFT、时域 RMS、低频能量）
2. 计算 ENERGY / BASS（峰值保持平滑）
3. 确定主导 Deck（BPM、曲目、段落）
4. 节拍时钟 / 节拍脉冲
5. 段落检测（Intro/Build/Drop/Break/Groove）
6. 更新大屏 VJ 视觉、灯光、光束、粒子、观众、机器人
7. 更新搓碟转盘与信息面板
8. 渲染 Three.js（含 Bloom 后处理与全屏噪点）

---

## 四、功能实现清单（对照需求）

### 4.1 双音轨 Deck A / Deck B

| 需求 | 实现 | 状态 |
|---|---|---|
| 最多导入 2 首本地音频（flac/mp3） | 点击 + 拖拽，自动分配 / 指定 Deck | 已实现 |
| 播放 / 暂停 | 标准播放状态管理，BufferSource 重建 | 已实现 |
| Cue 点 | 暂停时设置 Cue，播放中回到 Cue 并暂停 | 已实现 |
| 进度条 | 实时位置 + 点击/拖拽 seek，含 Cue 标记 | 已实现 |
| 音量滑块 | Deck GainNode，实时生效 | 已实现 |
| BPM 显示 | 离线检测，整数显示 | 已实现 |
| 搓碟转盘可视化 | Canvas 绘制，播放旋转，拖拽变速 / scrub | 已实现 |
| Filter 旋钮 | 左低通、右高通，中点直通 | 已实现 |

### 4.2 混音控制台

| 需求 | 实现 | 状态 |
|---|---|---|
| Crossfader 交叉推子 | 等功率曲线（cos/sin） | 已实现 |
| 高 / 低频 Filter | highshelf / lowshelf（±12dB） | 已实现 |
| 总音量 | MasterGain | 已实现 |
| MIX 切换按钮 | MIX-A/B 自动平滑渐变（约 1 秒） | 已实现 |

### 4.3 3D 虚拟 LiveHouse 舞台

| 需求 | 实现 | 状态 |
|---|---|---|
| 舞台大屏 | CanvasTexture 动态 VJ 视觉 | 已实现 |
| 舞台灯光（可调色） | 4 盏 SpotLight，颜色拾取联动 | 已实现 |
| 光束 | 半透明锥体，Additive 混合 | 已实现 |
| 粒子效果 | 700 粒子，BASS 爆发 | 已实现 |
| 台下观众小人 | InstancedMesh 胶囊剪影，节拍跳动 | 已实现 |
| 舞台机器人 VJ | 3 个拼装机器人，节拍摆臂转头 | 已实现 |
| 实时信息面板 | ENERGY / BASS / BPM / SECTION | 已实现 |

### 4.4 VJ 视觉控制

| 需求 | 实现 | 状态 |
|---|---|---|
| VJ 模式 | 螺旋 / 波形 / 频谱 / 隧道 | 已实现 |
| 灯光模式 | 静态 / 节拍脉冲 / 扫射 / 彩虹循环 | 已实现 |
| 灯光强度 | 0–100% 滑块 | 已实现 |
| 粒子开关 | 实时显隐 | 已实现 |
| 干涉噪点 | 大屏噪点 + 扫描线 + 全屏噪点 shader | 已实现 |
| 颜色拾取器 | 色板 / 色相 / RGB / 预设，全局联动 | 已实现 |

### 4.5 其他

- 界面中文，深色赛博暗紫霓虹风
- 布局：上方 3D 舞台、下方悬浮控制面板、右侧颜色拾取器、顶部信息面板
- 拖拽上传全屏遮罩，所有控件实时生效

---

## 五、关键技术实现

### 5.1 BPM 离线检测

- 音频解码后取单声道，块 RMS 能量包络（包络采样率约 200Hz）
- 跳过前 15s，取最多 60s 分析窗口
- onset 强度信号（正向差分）+ 局部均值归一化
- 自相关找节拍周期（对应 80–160 BPM），抛物线插值细化
- 倍频折叠到 90–180 区间

### 5.2 实时能量分析

- 时域 `getByteTimeDomainData` → RMS 总能量
- 频域 `getByteFrequencyData` → 低频（20–150Hz）平均能量
- 数值采用**快攻击、慢释放（峰值保持）**：
  - `v = max(target, v × 0.93~0.95)`
  - 避免节拍间隙数值闪烁，视觉更稳定

### 5.3 段落检测（启发式）

- 维护低频能量短窗（4s）与长窗（30s）均值
- 短窗持续上升 → Build；短窗 > 长窗 ×1.22 → Drop
- 短窗 < 长窗 ×0.75 → Break；开头 15s → Intro；其余 → Groove
- 标签防抖（候选持续 1.2s 才切换）

### 5.4 舞台大屏 VJ 视觉

- Canvas 2D（1024×512）→ CanvasTexture，每帧更新
- 螺旋：多臂螺旋随频谱扰动；波形：时域波形多层叠色
- 频谱：72 柱镜像；隧道：同心环向外扩张
- 干涉噪点：随机点 + 扫描线 + 移动干涉带

### 5.5 后处理

- UnrealBloomPass：霓虹辉光
- 自定义 ShaderPass：全屏噪点 / 扫描线（开关控制）

---

## 六、开发过程问题与修复

| # | 问题 | 现象 | 根因 | 修复 |
|---|---|---|---|---|
| 1 | 机器人取色报错 | 控制台 `eyeMat.set is not a function`，初始化中断 | Material 无 `.set` 方法，应作用于 `.color` | 改为 `eyeMat.color.set(hex)` |
| 2 | 主导 Deck 误选 | Crossfader 中点时 BPM / 曲目显示为空 Deck B | 中点 `f<0.5` 为 false，误选 B | 改为优先选正在播放的 Deck，再按推子位置 |
| 3 | 能量数值闪烁 | ENERGY/BASS 常显 0，节拍间隙掉值 | RMS 瞬时值 + 平滑衰减过快 | 改为快攻击、慢释放峰值保持 |
| 4 | 信息面板 BASS 口径错误 | 0.8 的 BASS 显示为 1% | 归一化值（0..1）被当百分比显示 | InfoPanel 按 `×100` 显示 |
| 5 | 初始参数未同步 | Deck 音量 / Filter 与 state 不一致 | 初始化后未写入音频节点 | 启动时同步音量、Filter、总音量、推子 |
| 6 | favicon 404 | 控制台 404 | 缺少站点图标 | 内联 SVG data URI 图标 |

---

## 七、测试验证报告

### 7.1 验证方式

- 本地静态服务器（python http.server）
- 合成测试音频：124 BPM（kick + hihat + Build/Drop 结构）、110 BPM
- 浏览器自动化走完整交互流程并截图

### 7.2 验证结果

| 验证项 | 结果 |
|---|---|
| 页面加载、无控制台报错 | 通过（0 error，仅 Tailwind CDN 生产提示） |
| 音频导入（点击 + 拖拽） | 通过 |
| BPM 检测准确性 | 通过（124 / 110 均准确） |
| 播放 / 暂停 / Cue / seek | 通过 |
| 音量 / Filter / EQ 实时生效 | 通过 |
| Crossfader 等功率混音 | 通过 |
| MIX-A / MIX-B 自动切换 | 通过（推子滑动、BPM 切换、按钮高亮） |
| 大屏 4 种 VJ 视觉 | 通过 |
| 颜色拾取全局联动 | 通过（灯光/大屏/粒子/转盘/UI 同步变色） |
| 粒子 / 观众 / 机器人开关 | 通过 |
| 搓碟转盘拖拽响应 | 通过（播放稳定，不中断） |
| 段落标签随结构变化 | 通过（Intro/Build/Drop/Break 正确切换） |

### 7.3 未覆盖项

- 真实商业曲库（长曲、复杂编曲）下的 BPM 与段落检测准确性
- FLAC 实机解码（合成测试为 WAV，FLAC 路径依赖 Chromium 解码能力）
- 不同硬件性能下的帧率表现

---

## 八、已知限制与风险

| 限制 | 说明 | 建议 |
|---|---|---|
| BPM 为估算值 | 复杂曲目可能偏差 | 已做倍频折叠与多策略回退 |
| 段落为启发式 | 与真实曲目标注可能不一致 | 仅作氛围展示 |
| Tailwind Play CDN | 官方标注不推荐生产，运行时编译 | 长期展示可切 Tailwind CLI 预编译 |
| FLAC 兼容性 | Chrome/Edge 支持，Safari/Firefox 有限 | 推荐 Chromium 系 |
| `file://` 限制 | ES Module 可能被拦截 | 推荐静态服务器 |
| 桌面端适配 | 未做移动端 | MVP 范围外 |

---

## 九、后续迭代建议

- 自动对拍（Sync）、变速不变调（Keylock）
- Hot Cue 多点、循环（Loop）、采样器、效果器链
- 混音录音 / 导出
- 更成熟的 BPM / 段落分析算法
- 移动端适配与性能分级（粒子数、像素比自适应）
- 多舞台场景切换、自定义模型导入

---

## 十、部署状态

- 本地开发：已完成，路径 `D:\Work\site\livehouse-dj`
- 静态服务器：本地可运行（端口 8123）
- GitHub 仓库：**待创建**（建议名 `livehouse-dj`）
- GitHub Pages：**待开启**（main 分支根目录部署）
- 资源路径：全部使用相对路径，适配 Pages 子路径
- 遵循约定：**未经用户明确指示不执行 git commit / 推送**，由用户验证通过后操作

---

## 十一、完整文件清单

```
livehouse-dj/
├── index.html
├── README.md
├── .gitignore
├── test_demo.wav            # 测试用（gitignore 忽略）
├── test_demo2.wav           # 测试用（gitignore 忽略）
├── prompts/                 # 用户提供的参考素材
│   ├── 参考1.png
│   └── 设计提示词.txt
├── docs/
│   ├── MVP_DESIGN.md
│   └── DEVELOPMENT_REPORT.md
├── css/
│   └── style.css
└── js/
    ├── main.js
    ├── state.js
    ├── audio/
    │   ├── AudioEngine.js
    │   ├── Deck.js
    │   ├── BPMDetector.js
    │   └── AudioAnalyser.js
    ├── stage/
    │   ├── StageScene.js
    │   ├── StageScreen.js
    │   ├── Lights.js
    │   ├── Particles.js
    │   ├── Crowd.js
    │   ├── RobotVJ.js
    │   └── colorUtils.js
    └── ui/
        ├── DeckPanel.js
        ├── MixerPanel.js
        ├── VJPanel.js
        ├── InfoPanel.js
        └── ColorPicker.js
```

---

## 十二、结论

MVP 范围内全部功能已开发并通过本地验证，页面可稳定运行、控制台无错误，音频分析与 3D 视觉联动符合设计预期。待用户实机验收后，即可创建 GitHub 仓库并开启 Pages 部署。
