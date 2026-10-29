# 三角洲全面战场自定义局内提示工具 · Delta Force Battlefield HUD Tool

> 一个把「局内提示」做成可预览、可导出视频的桌面小工具。左侧改字改图，右侧 1920×1080 舞台实时预览，一键导出蓝幕 MP4 或带透明通道的 WebM，直接丢进剪辑软件就能用。

![status](https://img.shields.io/badge/status-alpha-orange)
![version](https://img.shields.io/badge/version-0.0.1--alpha.1-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Windows%2010%2F11-lightgrey)

---

## 这是什么

本工具是一个基于 **Electron + 原生 HTML/CSS/JS** 的桌面工具，用来制作战术射击游戏风格的局内提示动效：

- 想给游戏录制定制提示视频？在这里排好文字、选好图标、调好停留时长，导出成片。
- 想给视频加一条弹入弹出的战术提示条？用透明 WebM 直接叠在素材上。

没有构建步骤、没有前端框架、没有后端，`card.html` 打开就是全部界面逻辑。

## 功能特性

**版式**
- 图标大卡（icon）：左侧图标面板 + 右侧标题/副标题，整卡横向展开动效
- 横幅（banner）：上下描边 + 文字滑入
- 窄条（toast）：宽度按文字实时测量自适应，始终居中

**编辑与预览**
- 1920×1080 舞台，随窗口自动缩放，所见即所得
- 即时播报：自定义标题、副标题、版式、图标，回车即播
- 内置提示库 13 条，分「战术技能 / 据点事件 / 全局事件」三类
- 停留时长可调（默认 1500 ms）
- 蓝幕背景一键开关，方便观察抠像效果

**视频导出**
- 蓝幕 MP4（`#0400f4`，供抠像）
- 黑底 MP4
- 透明 WebM（VP9 + `yuva420p`，剪辑软件可直接识别 alpha）
- 固定 30 fps、1920×1080

> 导出没有用主窗口 `capturePage`——小屏幕上 1920×1080 的舞台塞不进可见窗口，抓出来会被裁切。实际做法是主进程另开一个隐藏窗口，把舞台缩放到窗口内、逐帧渲染后 `capturePage` 取 PNG，通过管道喂给 ffmpeg，必要时再由 ffmpeg 用 lanczos 放大回 1920×1080。

## 快速开始

环境要求：**Node.js 18+**、Windows 10/11。

```bash
git clone https://github.com/Robot27-xiaosong/deltaforce-hud-tool.git
cd deltaforce-hud-tool
npm install
npm start
```

`npm install` 会带上 `ffmpeg-static`（约 80 MB），导出功能依赖它。

### 字体

`card.html` 里声明了两个字体族，对应文件已放在 `assets/fonts/`：

```css
@font-face{font-family:"DFUI";  src:url("assets/fonts/FZLTZHJW.ttf") format("truetype");}
@font-face{font-family:"DFUI-L";src:url("assets/fonts/FZLTHJW.ttf") format("truetype");}
```

这两款是方正兰亭系列**商业字体**，仓库中的文件来自网络收集，未取得授权，版权归字体厂商所有，不适用本项目的 MIT 许可。个人测试没问题，**商用或正式发布请自行购买授权，或换成可自由分发的字体**（思源黑体 / Noto Sans SC 等）。细节见 [NOTICE.md](NOTICE.md)。

把字体文件删掉也能跑，页面会自动回退到 `Microsoft YaHei` / `sans-serif`，只是字形更普通。

## 使用说明

1. 左侧「即时播报」填标题、副标题，选版式与图标，点 **立即弹出**。
2. 或者直接点「提示库」里的条目预览。
3. 调整「停留」时长，决定画面停留多久。
4. 选导出背景，点 **导出当前提示为视频**，选择保存位置。
5. 导出过程中按钮会禁用，完成后状态栏显示文件路径与大小。

导出耗时随停留时长增长，30 fps ×（进入 1.05 s + 停留 + 退出 1.06 s）。

## 目录结构

```
deltaforce-hud-tool/
├── main.js          Electron 主进程：窗口、隐藏抓取窗口、ffmpeg 管道
├── preload.js       contextBridge 暴露的导出 API
├── card.html        主界面：布局、动效渲染引擎、导出流程
├── assets/          5 个技能图标（skill_p1~p5）
│   └── fonts/       中文字体（许可情况见 NOTICE）
├── package.json
├── LICENSE
└── NOTICE.md        第三方素材与商标说明
```

## 打包 Windows 便携版

```bash
npm run build
```

产物在 `dist/三角洲全面战场自定义局内提示工具.exe`（单文件便携版，约 117 MB，内含 Electron 与 ffmpeg）。首次构建会下载 Electron 二进制，耗时较久。

想改产品名，编辑 `package.json` 的 `build.productName` 与 `build.portable.artifactName`。

## 自定义

- **提示库**：`card.html` 里的 `MSG` 数组，字段 `{cat, type, t, s, icon}`。`cat` 取 `skill|point|event`，`type` 取 `icon|banner|toast`。
- **图标**：PNG 放进 `assets/`，在 `MSG` 和 `<select id="inIcon">` 里引用文件名（不带扩展名）。
- **动效曲线**：`W_KEYS` / `TITLE_KEYS` / `ICON_KEYS` 等关键帧数组，`sample()` 做线性采样，改数值即可调手感。
- **配色**：界面用 `#4ec9d8`（青）与 `#d97a2b`（橙），卡片底色由 `renderEnter()` 里的 `rgb(51,51,51)` 基准色控制。

## 路线图

- [ ] 自定义导出分辨率与帧率
- [ ] 提示库可视化编辑 / 导入导出 JSON
- [ ] 批量导出（一次渲染整组提示）
- [ ] 导出进度条与预计剩余时间
- [ ] 素材替换向导，方便换成自己的图标包

## 已知限制

- 仅针对 Windows 打包（`electron-builder --win portable`）。
- 导出受 `capturePage` 与实际渲染性能限制，长停留时长会线性变慢。
- 透明 WebM 的 alpha 通道 ffprobe 检测不到，但浏览器与主流剪辑软件可正常识别。

## 版权与免责

- 本项目与游戏发行商、开发商无任何关联，是非官方工具。
- `assets/` 中的 5 个技能图标为自用简化图形，按 MIT 许可提供；仓库不含任何游戏原始素材，详见 [NOTICE.md](NOTICE.md)。
- 字体文件已随仓库附带，但来源与授权情况需自行确认，见上文「字体」一节。

## 许可证

[MIT](LICENSE) © 2026 Delta Force Battlefield HUD Tool contributors

---

## English

**Delta Force Battlefield HUD Tool** is a small Electron desktop app for authoring tactical-shooter style in-game HUD alert cards and exporting them as video.

**Highlights**

- 1920×1080 stage with live preview, auto-scaled to the window
- Three layouts: icon card, banner, and auto-width toast
- Editable title / subtitle / icon, built-in alert library grouped in three categories
- Adjustable hold duration, chroma-key background toggle
- Export to chroma MP4 (`#0400f4`), black MP4, or **transparent WebM** (VP9 + alpha)
- Export pipeline: hidden 1920×1080 capture window → per-frame `capturePage` → PNG → ffmpeg stdin, so the output is never cropped

**Quick start**

```bash
npm install
npm start      # run
npm run build  # Windows portable exe in dist/
```

Requires Node.js 18+. The UI uses two commercial Chinese typefaces (FZLanTing family) that are included in `assets/fonts/` as found online — their license status is unverified, so buy a license or swap in an open font before commercial use. Details in [NOTICE.md](NOTICE.md).

Licensed under MIT. Not affiliated with any game publisher.
