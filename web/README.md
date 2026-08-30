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

## Google AdSense

Your publisher ID (`ca-pub-8588643882726955`) is verified via:

- `<meta name="google-adsense-account">` in `index.html` `<head>`
- AdSense script in `<head>`
- `public/ads.txt` at `/LUT_LAB/ads.txt`

**In AdSense, add the site exactly as:** `tariqjaradat12.github.io/LUT_LAB`  
(include the `/LUT_LAB` path — not just `github.io`).

After deploy, wait a few minutes, then click **Verify** in AdSense. Use the **Meta tag** verification method if offered.

To show ads in the tool panel footer:

1. In [AdSense](https://adsense.google.com) go to **Ads → By ad unit → Display ad**
2. Create a responsive display unit for Lut Lab
3. Copy the number from `data-ad-slot="…"` in the code Google gives you
4. Add GitHub repo secret **`VITE_ADSENSE_SLOT`** (Settings → Secrets → Actions) with that number
5. Redeploy (push to `main` or re-run the Deploy workflow)

For local dev, put the same value in `web/.env` as `VITE_ADSENSE_SLOT=your_slot_number`.

## Custom domain (optional)

In **Settings → Pages**, add a domain (e.g. `lutlab.app`) and point DNS to GitHub Pages.
