# NOTICE

## 素材与商标

`assets/skill_p1.png` ~ `skill_p5.png` 为本项目自用的简化示意图标（炮击 / 烟幕 / 制导 / 信标 / 载具），随本仓库按 MIT 许可提供。

仓库**不包含**任何游戏原始 UI 素材。项目名称与 README 中提及的游戏名称仅用于描述所模仿的风格，不表示任何官方关联、赞助或背书。

## 字体

`assets/fonts/` 内含两款中文字体文件：

- `FZLTZHJW.ttf` — 方正兰亭中黑，对应字体族 `DFUI`
- `FZLTHJW.ttf` — 方正兰亭黑，对应字体族 `DFUI-L`

这两款是方正（Founder）商业字体。仓库中的文件系从网络收集，**本项目未取得授权，随仓库分发存在版权风险**；字体本身的版权归字体厂商所有，不适用本项目的 MIT 许可。

商用或正式发布前，建议购买授权，或替换为可自由分发的字体（如思源黑体 / Noto Sans SC），替换后同步修改 `card.html` 顶部的 `@font-face` 与 `font-family` 声明即可。

如权利人提出异议，请提交 issue，我们会立即移除相关文件。

## 第三方开源组件

| 组件 | 许可 |
| --- | --- |
| Electron | MIT |
| ffmpeg-static（FFmpeg 二进制） | LGPL / GPL，取决于编译选项，详见其仓库 |
| electron-builder | MIT |

打包产物中包含 FFmpeg 可执行文件，分发时请遵守其许可要求并保留相应声明。
