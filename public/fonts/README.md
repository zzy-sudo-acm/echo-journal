# Journal font assets

The journal fonts are self-hosted from their official open-source releases. Full fonts are converted to WOFF2 without changing glyph data. The `preview-*` files are subsets containing only the settings preview sentence, so opening settings does not fetch every complete font.

| UI option | Source font | Official source | Version | License |
| --- | --- | --- | --- | --- |
| 文楷 | LXGW WenKai GB Screen / 霞鹜文楷屏幕阅读版 | <https://github.com/lxgw/LxgwWenKai-Screen> | v1.522 | [SIL OFL 1.1](licenses/LXGW-WenKai-Screen-OFL.txt) |
| 宋体 | Source Han Serif CN / 思源宋体 | <https://github.com/adobe-fonts/source-han-serif> | 2.003R | [SIL OFL 1.1](licenses/Source-Han-Serif-OFL.txt) |
| 仿宋 | Zhuque Fangsong / 朱雀仿宋 | <https://github.com/TrionesType/zhuque> | v0.212 | [SIL OFL 1.1](licenses/Zhuque-Fangsong-OFL.txt) |
| 手写 | ChenYuluoyan Thin / 辰宇落雁体细体 | <https://github.com/Chenyu-otf/chenyuluoyan_thin> | v2.0 | [SIL OFL 1.1](licenses/ChenYuluoyan-OFL.txt) |

No font is fetched from a CDN. Full font files load only when the corresponding journal font is selected; the service worker caches requested fonts on demand.
