# Lut Lab

Browser photo editor — grade locally, nothing uploads to a server.

## Live site

**https://tariqjaradat12.github.io/LUT_LAB/**

## Enable hosting (one-time, ~30 seconds)

1. Open **[Settings → Pages](https://github.com/tariqjaradat12/LUT_LAB/settings/pages)**
2. Under **Build and deployment → Source**, choose **Deploy from a branch**
3. **Branch:** `gh-pages` · **Folder:** `/ (root)` · click **Save**
4. Wait 1–2 minutes, then open the link above

The **Deploy Lut Lab** workflow builds the site and pushes it to the `gh-pages` branch automatically.

## Develop locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173

## Google AdSense (optional)

Ads only appear in the **tool panel footer** — never on the preview canvas or over your photo/video.

1. Get approved at [Google AdSense](https://adsense.google.com)
2. Copy `web/.env.example` to `web/.env`
3. Set `VITE_ADSENSE_CLIENT` (e.g. `ca-pub-…`) and `VITE_ADSENSE_SLOT`
4. Rebuild and deploy

For GitHub Pages, add repo secrets `VITE_ADSENSE_CLIENT` and `VITE_ADSENSE_SLOT` (Settings → Secrets → Actions).

Leave the vars empty to ship with no ads.

## Custom domain (optional)

In **Settings → Pages**, add a domain (e.g. `lutlab.app`) and point DNS to GitHub Pages.
