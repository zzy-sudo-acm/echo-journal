# Journal font assets

The journal fonts are self-hosted from their official open-source releases. Full fonts are converted to WOFF2 without changing glyph data. The `preview-*` files are subsets containing only the settings preview sentence, so opening settings does not fetch every complete font.

| UI option | Source font | Official source | Version | License |
| --- | --- | --- | --- | --- |
| 圆体 | Resource Han Rounded CN / 资源圆体 | <https://github.com/CyanoHao/Resource-Han-Rounded> | v0.990 | [SIL OFL 1.1](licenses/Resource-Han-Rounded-OFL.txt) |
| 书卷 | Zhuque Fangsong / 朱雀仿宋 | <https://github.com/TrionesType/zhuque> | v0.212 | [SIL OFL 1.1](licenses/Zhuque-Fangsong-OFL.txt) |
| 个性 | Smiley Sans / 得意黑 | <https://github.com/atelier-anchor/smiley-sans> | v2.0.1 | [SIL OFL 1.1](licenses/Smiley-Sans-OFL.txt) |
| 手写 | ChenYuluoyan Thin / 辰宇落雁体细体 | <https://github.com/Chenyu-otf/chenyuluoyan_thin> | v2.0 | [SIL OFL 1.1](licenses/ChenYuluoyan-OFL.txt) |

No font is fetched from a CDN. Full font files load only when the corresponding journal font is selected; the service worker caches requested fonts on demand.
