# Third-party fonts

All journal fonts are self-hosted. No font is loaded from a CDN. Full fonts are converted to WOFF2, while settings previews use subsets generated from the same pinned source files.

| UI option | Font | Official source | Version | License |
| --- | --- | --- | --- | --- |
| 圆体 | Resource Han Rounded CN / 资源圆体 | <https://github.com/CyanoHao/Resource-Han-Rounded> | v0.990 | [SIL OFL 1.1](public/fonts/licenses/Resource-Han-Rounded-OFL.txt) |
| 书卷 | Zhuque Fangsong / 朱雀仿宋 | <https://github.com/TrionesType/zhuque> | v0.212 | [SIL OFL 1.1](public/fonts/licenses/Zhuque-Fangsong-OFL.txt) |
| 个性 | Smiley Sans / 得意黑 | <https://github.com/atelier-anchor/smiley-sans> | v2.0.1 | [SIL OFL 1.1](public/fonts/licenses/Smiley-Sans-OFL.txt) |
| 手写 | Ma Shan Zheng / 马善政毛笔楷书 | <https://github.com/googlefonts/mashanzheng> | v2.002, commit `6bfdbe288f5935c6e9072cdd6ab1aa102a006aab` | [SIL OFL 1.1](public/fonts/licenses/Ma-Shan-Zheng-OFL.txt) |

The handwriting preview subset explicitly includes the complete settings sentence and the coverage check characters `转 这 风 页 乱 书 旧 后 发 里 边 体`. Both handwriting WOFF2 files were verified through `fontTools.ttLib.TTFont` Unicode cmap inspection.
