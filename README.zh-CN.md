# doff

<p align="center">
  <img src="public/icon-512.png" alt="doff 应用图标" width="256" height="256">
</p>

<p align="center">
  <strong>本地优先、离线可用的差异比对工具，支持文本、图片、文档、电子表格和文件夹。</strong>
</p>

<p align="center">
  doff 完全在浏览器中运行 — 无需上传、无需账号、无需服务器。私密、即时地比较文件。
</p>

<p align="center">
  <a href="README.md">English Doc</a>
</p>

<p align="center">
  <a href="https://doff-franklioxygen.vercel.app"><strong>在线体验</strong></a>
</p>

![Screenshot 2026-03-23 at 11 54 06 AM](https://github.com/user-attachments/assets/cf698d43-ee57-452c-8855-89ca12d344dc)

## 功能特性

- **文本差异** — 支持并排和统一视图，行内高亮显示差异，基于 Monaco Editor。
- **图片对比** — 像素级差异比对，支持叠加、并排和滑块模式。
- **文档差异** — 逐页比较 PDF 文档。
- **表格差异** — 逐单元格比较 Excel (.xlsx) 和 CSV 文件。
- **文件夹差异** — 比较目录结构和内容。
- **离线可用** — 可安装的 PWA 应用，无需网络连接即可使用。
- **多语言** — 支持英语、西班牙语、法语、德语、日语和中文。
- **深色模式** — 自动或手动切换主题。

## 隐私保护

- 无需账号，也没有云端后台。
- 所有处理都在你的浏览器或桌面应用本地完成。
- 文件永远不会离开你的设备。
- 官方托管在 Vercel 上的在线体验，以及从该部署安装的 PWA，只会在 production 部署中启用 Google Analytics，用于统计汇总访问流量。
- Demo 使用的 Google Analytics 不会嵌入应用源码，也不会出现在桌面安装包、Docker / 自托管部署或本地开发构建中。

## 快速开始

doff 提供两种使用方式：作为**独立应用**直接安装到设备上，或通过 Docker 进行**容器化部署**。

### 独立应用

从 [Releases](https://github.com/franklioxygen/doff/releases) 页面下载适合你平台的最新安装包，支持 macOS、Windows 和 Linux。

你也可以访问[在线体验](https://doff-franklioxygen.vercel.app)，通过浏览器将其安装为渐进式 Web 应用。

说明：官方托管在 Vercel 上的在线体验只会在 production 部署中启用 Google Analytics。桌面安装包**不包含** Google Analytics。

### 容器部署 (Docker)

```bash
docker run -d -p 5560:80 --name doff ghcr.io/franklioxygen/doff:latest
```

或使用 Docker Compose：

```bash
docker compose up -d
```

然后打开 [http://localhost:5560](http://localhost:5560)。

Docker 和其他自托管部署**不包含** Google Analytics。

### 从源码构建

```bash
git clone https://github.com/franklioxygen/doff.git
cd doff
npm install
npm run dev
```

## 环境要求

- **独立应用**：任意现代浏览器（Chrome、Firefox、Safari、Edge）
- **容器部署**：Docker 或 Docker Compose
- **开发环境**：Node.js 20+

## 许可证

MIT
