# fonts

本目录包含两款中文字体文件：

| 字体族 | 文件名 | 说明 |
| --- | --- | --- |
| `DFUI` | `FZLTZHJW.ttf` | 方正兰亭中黑 |
| `DFUI-L` | `FZLTHJW.ttf` | 方正兰亭黑 |

这两款属于方正（Founder）商业字体，文件来自网络收集，**未取得授权**，版权归字体厂商所有，不适用本项目的 MIT 许可。商用或正式发布请自行购买授权，或替换为可自由分发的字体（如思源黑体 / Noto Sans SC）。

**替换字体**：把新字体放进本目录，然后修改 `card.html` 顶部的两行 `@font-face`（路径）即可。除文件名外，`font-family` 名 `DFUI` / `DFUI-L` 可以保留，页面其它地方不用改。

删掉这两个文件应用仍可运行，中文会回退到 `Microsoft YaHei` 或 `sans-serif`。
