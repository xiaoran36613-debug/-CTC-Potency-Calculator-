# CTC Potency Calculator（金霉素效价计算器）

纯静态单页应用，已升级为可安装的 PWA：支持添加到手机主屏幕、离线使用，所有计算与数据（localStorage）均在本地完成，不上传任何用户输入。

在线地址：<https://xiaoran36613-debug.github.io/-CTC-Potency-Calculator-/>

## 项目结构

```
index.html                 应用本体（全部 UI + 计算逻辑）
manifest.json              PWA 清单（名称/图标/启动方式）
sw.js                      Service Worker（离线缓存）
icons/                     应用图标（192/512/maskable/apple-touch-icon）
scripts/generate-icons.js  图标生成脚本（可选，纯 Node 无依赖）
```

## 本地测试 PWA

Service Worker 与「添加到主屏幕」需要 `localhost` 或 HTTPS 环境，直接双击打开 file:// 是不行的：

```bash
cd 仓库目录
python -m http.server 8123     # 或 npx serve .
# 浏览器访问 http://localhost:8123/
```

验证方法：

- Chrome 打开 DevTools → Application 面板：
  - Manifest 无报错、图标正常显示；
  - Service Workers 状态为 `activated`；
  - 勾选 Offline 后刷新页面，应用仍能打开并计算（离线）。
- 手机与电脑同一局域网时，可用 `http://<电脑IP>:8123` 在手机浏览器体验（局域网安装 PWA 需要 HTTPS，真机安装请在 GitHub Pages 上验证）。

## 部署（GitHub Pages）

```bash
git add index.html manifest.json sw.js icons/
git commit -m "feat: 升级为 PWA（可安装 + 离线可用）"
git push origin main
```

推送后等 1~2 分钟 GitHub Pages 更新即可。注意：

- Service Worker 缓存版本号在 `sw.js` 顶部的 `CACHE_VERSION`，以后每次改动页面内容请同步递增（如 `ctc-v1.0.1`），否则老用户可能继续看到旧缓存。
- 首次部署后，建议在自己手机上「添加到主屏幕」实测一次。

## 修改图标

编辑 `scripts/generate-icons.js` 中的绘图参数后运行：

```bash
node scripts/generate-icons.js
```
