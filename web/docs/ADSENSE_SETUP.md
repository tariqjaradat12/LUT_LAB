# Google AdSense for Lut Lab

## The form wants a **website address**, not the app name

| Do **not** enter | Enter instead |
|------------------|---------------|
| Lut Lab | `tariqjaradat12.github.io` |
| lut lab | (no spaces) |
| https://tariqjaradat12.github.io/LUT_LAB/ | Often rejected — see below |

AdSense’s **Website** field is for a **domain**, like `example.com` or `yoursite.github.io`.

---

## Why `/LUT_LAB/` is a problem

Your app lives at a **GitHub project path**:

`https://tariqjaradat12.github.io/LUT_LAB/`

Google AdSense usually wants a **top-level site**, not a folder under `github.io`. Many people get errors or failed verification with `/repo-name/` URLs.

You have **two paths that work**:

### Option A — Custom domain (recommended for AdSense)

1. Buy a domain (e.g. `lutlab.app`, ~$10/year from Namecheap, Cloudflare, etc.)
2. In GitHub: **LUT_LAB repo → Settings → Pages → Custom domain** → enter your domain
3. At your DNS provider, add the records GitHub shows (usually `A` + `CNAME` for `www`)
4. In AdSense → **Sites → Add site**, enter: `yourdomain.com` (no `https://`, no path)
5. Set a GitHub repo variable **`VITE_BASE`** = `/` (Settings → Secrets and variables → Actions → Variables)
6. Push to `main` to redeploy

### Option B — User GitHub Pages (free) **← current plan**

Lut Lab deploys to **`https://tariqjaradat12.github.io/`** (site root) for AdSense.

**One-time setup:** follow **[docs/USER_PAGES_SETUP.md](docs/USER_PAGES_SETUP.md)** (create repo, deploy key, secret).

In AdSense, add: **`tariqjaradat12.github.io`**

The old URL `…/LUT_LAB/` stays as a mirror until you stop using it.

---

## Verification checklist

After deploy, confirm:

- [View source](https://tariqjaradat12.github.io/LUT_LAB/) shows `google-adsense-account` in `<head>`
- [ads.txt](https://tariqjaradat12.github.io/LUT_LAB/ads.txt) loads
- [Privacy policy](https://tariqjaradat12.github.io/LUT_LAB/privacy.html) is linked from the app

In AdSense: **Sites → your domain → Verify** (meta tag or script method).

---

## After approval — show ads in the panel

1. **Ads → By ad unit → Display ad** → create a responsive unit
2. Copy `data-ad-slot="…"`
3. GitHub secret **`VITE_ADSENSE_SLOT`** = that number
4. Redeploy
