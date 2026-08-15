# 回声日记 / Echo Journal

> 一款本地优先、离线可用的极简日记应用

回声日记是一款移动端优先、本地优先的私人日记应用。数据默认保存在浏览器或 App 本地 IndexedDB 中，无需注册账号，不上传任何服务器。

## 功能

- 日记记录（标题、正文、时间、标签）
- 快捷记录：自动保存草稿、轻量 Markdown（标题 / 列表 / 引用 / 分隔线 / 粗斜体）
- 快捷输入与富文本编辑器支持本地图片（本机压缩保存，不上传）
- 今日时间线与过去的今天
- 月历浏览
- 标签筛选与全文搜索
- 回收站（软删除 + 撤销）
- ZIP 完整备份（含图片与 SHA-256 校验）、导入与恢复
- 内部每日快照（自动保留最近 7 份，可手动固定）
- PWA 可安装、离线可用
- 深色 / 浅色主题
- 多款正文字体（现代、圆体、书卷、个性、手写）
- Android APK（Capacitor 封装）
- **当前版本不包含 AI 功能**

## 在线使用

网页版地址：

https://zzy-sudo-acm.github.io/echo-journal/

## 本地开发

```bash
# 安装依赖
npm ci

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint

# 构建网页版
npm run build

# 构建 Android APK
npm run build:android
npx cap sync android
cd android && .\gradlew.bat assembleDebug
```

## 技术栈

- React 19 + TypeScript
- Vite 8
- IndexedDB (Dexie.js)
- Zustand
- React Router (Hash 模式)
- vite-plugin-pwa + Workbox
- Vitest + fake-indexeddb
- Capacitor (Android)
- GitHub Pages + GitHub Actions

## 跨平台使用

| 平台 | 方式 |
|------|------|
| Web | 直接访问 [Pages 地址](https://zzy-sudo-acm.github.io/echo-journal/) |
| iOS | Safari → 分享 → 添加到主屏幕 |
| Android | Chrome → 菜单 → 添加到主屏幕，或安装 APK |
| 桌面 | 浏览器访问 Pages 地址 |

## 数据备份

数据仅保存在当前设备，不同设备间需手动导出/导入。请定期导出备份。

Android 版本不会使用系统自动云备份；卸载或清除应用数据前，请先在应用内导出 ZIP。

备份文件包含 `backup.json`（完整恢复）和 `journal.md`（可阅读 Markdown）。

## 已知限制

- 数据仅保存在当前设备，无云同步
- 浏览器可能清理 IndexedDB（请定期导出备份）
- 搜索为简单子串匹配，不支持全文索引
- 图片保存在本机 IndexedDB，受浏览器/系统存储配额限制；建议控制单条日记的图片数量并定期导出
- 暂不支持视频、音频与普通文件附件
- 大体积图片备份的导入/导出会占用较多内存，照片很多时建议分批处理

---

**数据保存在你的设备中。请定期导出备份。**
