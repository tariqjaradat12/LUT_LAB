# Lut Lab

**Live app:** [https://tariqjaradat12.github.io/LUT_LAB/](https://tariqjaradat12.github.io/LUT_LAB/)

Lut Lab is a local-first photo editor that runs in your browser. Open a photo, grade it, and export — nothing uploads to a server.

Works on desktop and mobile (Chrome, Edge, Safari, etc.).

## Features

- Light, color, curves, HSL, detail
- Lens & film: vignette, grain, halation, bokeh, anamorphic streaks
- Masks and double exposure
- Fully local — photos stay on your device

## Develop locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173

## Deploy

Pushes to `main` that touch `web/` auto-deploy via GitHub Actions to GitHub Pages (`gh-pages` branch).

Repo → **Settings → Pages** → source: **Deploy from branch** → `gh-pages` / root.

## Privacy

No accounts, no cloud storage, no photo uploads. Editing happens entirely in the browser.
