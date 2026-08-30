# One-time setup: Lut Lab on tariqjaradat12.github.io (Option B)

Do these steps once. After that, every push to `main` updates **both** URLs:

- **Primary (AdSense):** https://tariqjaradat12.github.io/
- **Legacy mirror:** https://tariqjaradat12.github.io/LUT_LAB/

---

## Step 1 — Create the GitHub repo (2 minutes)

1. Open: **https://github.com/new**
2. **Repository name:** `tariqjaradat12.github.io` (must match your username exactly)
3. **Public** → Create repository (empty — no README is fine)

---

## Step 2 — Enable GitHub Pages on that repo

1. Open **https://github.com/tariqjaradat12/tariqjaradat12.github.io/settings/pages**
2. **Source:** Deploy from a branch
3. **Branch:** `gh-pages` · **/ (root)** → Save  
   (The branch appears after the first deploy; if missing, finish Step 3 first, then come back.)

---

## Step 3 — Deploy key (lets LUT_LAB repo push to user site)

In PowerShell, from the project folder:

```powershell
cd "C:\Users\green\Desktop\my android app"
powershell -ExecutionPolicy Bypass -File web/scripts/setup-user-pages.ps1
```

The script prints:

1. A **public key** → add to **tariqjaradat12.github.io** → Settings → Deploy keys → Add deploy key  
   - Title: `LUT_LAB deploy`  
   - Allow write access: **checked**

2. A **private key** → add to **LUT_LAB** repo → Settings → Secrets and variables → Actions → New secret  
   - Name: `GH_PAGES_DEPLOY_KEY`  
   - Value: paste the entire private key file contents

---

## Step 4 — Trigger deploy

Push any change to `main`, or run **Actions → Deploy Lut Lab → Run workflow**.

---

## Step 5 — AdSense

In AdSense → **Sites → Add site**, enter:

```
tariqjaradat12.github.io
```

Verify using the meta tag method. Your site URL is now **https://tariqjaradat12.github.io/** (no `/LUT_LAB`).

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| User site 404 | Repo name must be `tariqjaradat12.github.io`, Pages on `gh-pages` |
| Deploy step skipped | Add `GH_PAGES_DEPLOY_KEY` secret to **LUT_LAB** repo |
| Permission denied on deploy | Deploy key needs **write** access on user site repo |
