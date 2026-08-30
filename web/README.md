# Lut Lab

Browser photo editor — grade locally, nothing uploads to a server.

## Live site

**Primary:** https://tariqjaradat12.github.io/ (after [user Pages setup](docs/USER_PAGES_SETUP.md))  
**Legacy mirror:** https://tariqjaradat12.github.io/LUT_LAB/

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

## Google AdSense

**The AdSense “website” field needs a domain — not “Lut Lab”.**  
See **[docs/ADSENSE_SETUP.md](docs/ADSENSE_SETUP.md)** for full steps.

Quick summary:

1. Try adding **`tariqjaradat12.github.io`** (no `https://`, no spaces, no app name).
2. If Google rejects the `/LUT_LAB/` path, use a **custom domain** (best) or a **`tariqjaradat12.github.io`** user Pages repo at the site root.
3. Verification tags and `ads.txt` are already in the build.
4. Link to the **[privacy policy](https://tariqjaradat12.github.io/LUT_LAB/privacy.html)** is in the top bar.

## Custom domain (optional)

In **Settings → Pages**, add a domain (e.g. `lutlab.app`) and point DNS to GitHub Pages.
