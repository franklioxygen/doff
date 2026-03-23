# doff

<p align="center">
  <img src="public/icon-512.png" alt="doff app icon" width="256" height="256">
</p>

<p align="center">
  <strong>Local-first, offline-ready diff workspace for text, images, documents, spreadsheets, and folders.</strong>
</p>

<p align="center">
  doff runs entirely in your browser — no uploads, no accounts, no servers. Compare files privately and instantly.
</p>

<p align="center">
  <a href="README.zh-CN.md">中文文档</a>
</p>

<p align="center">
  <a href="https://doff-franklioxygen.vercel.app"><strong>Live Demo</strong></a>
</p>

![Screenshot 2026-03-23 at 11 43 06 AM](https://github.com/user-attachments/assets/93ef493a-8a92-420b-924e-b9cbcd1dc551)

## Features

- **Text diff** — side-by-side and unified views with intraline highlighting, powered by Monaco Editor.
- **Image compare** — pixel-level diffing with overlay, side-by-side, and slider modes.
- **Document diff** — compare PDF documents page by page.
- **Spreadsheet diff** — compare Excel (.xlsx) and CSV files cell by cell.
- **Folder diff** — compare directory structures and contents.
- **Offline-ready** — installable PWA that works without an internet connection.
- **Multi-language** — English, Spanish, French, German, Japanese, and Chinese.
- **Dark mode** — automatic or manual theme switching.

## Privacy

- No account and no cloud backend.
- All processing happens locally in your browser or desktop app.
- Files never leave your machine.
- The official Vercel-hosted live demo, including the PWA installed from that deployment, enables Google Analytics only on the production deployment to measure aggregate traffic.
- Demo purpose Google Analytics is not embedded in the app source code and is not included in desktop installers, Docker/self-hosted deployments, or local development builds.

## Getting Started

doff can be used in two ways: as a **standalone app** installed directly on your device, or as a **containerized service** deployed via Docker.

### Standalone App

Download the latest installer for your platform from the [Releases](https://github.com/franklioxygen/doff/releases) page. Available for macOS, Windows, and Linux.

You can also visit the [Live Demo](https://doff-franklioxygen.vercel.app) and install it as a Progressive Web App from your browser.

Note: the official Vercel-hosted live demo enable Google Analytics only on the production deployment. Desktop installers **do not include** Google Analytics.

### Container Deployment (Docker)

```bash
docker run -d -p 5560:80 --name doff ghcr.io/franklioxygen/doff:latest
```

Or use Docker Compose:

```bash
docker compose up -d
```

Then open [http://localhost:5560](http://localhost:5560).

Docker and other self-hosted deployments **do not includ** Google Analytics.

### Build from Source

```bash
git clone https://github.com/franklioxygen/doff.git
cd doff
npm install
npm run dev
```

## Requirements

- **Standalone App**: Any modern browser (Chrome, Firefox, Safari, Edge)
- **Container Deployment**: Docker or Docker Compose
- **Development**: Node.js 20+

## License

MIT
