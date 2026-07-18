# 回声日记 / Echo Journal

> 一款本地优先、离线可用的极简日记应用

回声日记是一款移动端优先、本地优先的私人日记应用。数据默认保存在浏览器或 App 本地 IndexedDB 中，无需注册账号，不上传任何服务器。

## 功能

- 日记记录（标题、正文、时间、标签）
- 快速记录与草稿自动保存
- 今日时间线与过去的今天
- 月历浏览
- 标签筛选与全文搜索
- 回收站（软删除 + 撤销）
- ZIP 完整备份、导入与恢复
- 内部每日快照
- PWA 可安装、离线可用
- 深色 / 浅色主题
- 多款正文字体（现代、圆体、书卷、个性、手写）
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

备份文件包含 `backup.json`（完整恢复）和 `journal.md`（可阅读 Markdown）。

## 已知限制

- 数据仅保存在当前设备，无云同步
- 浏览器可能清理 IndexedDB（请定期导出备份）
- 搜索为简单子串匹配，不支持全文索引
- 第一版不支持图片和文件附件

---

**数据保存在你的设备中。请定期导出备份。**
