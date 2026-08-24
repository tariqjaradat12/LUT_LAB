# Lut Lab

Browser photo editor — grade locally, nothing uploads to a server.

## Live site

After GitHub Pages is enabled, the app is at:

**https://zebrastripes125.github.io/LUT_LAB/**

## Enable hosting (one-time)

1. Open [github.com/zebrastripes125/LUT_LAB/settings/pages](https://github.com/zebrastripes125/LUT_LAB/settings/pages)
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. Push to `main` — the **Deploy Lut Lab** workflow publishes the site

## Develop locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173

## Custom domain (optional)

In repo **Settings → Pages**, add a domain like `lutlab.app` and point DNS to GitHub Pages.
