# Web Photo Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local-first Vite + React + WebGL photo editor in `web/` that replaces the RN app for photos, with darkroom UI, positional halation, and Fuji-style double exposure.

**Architecture:** SPA with `EditParams` state driving a WebGL preview/export pass. No backend. Native RN code is reference only.

**Tech Stack:** Vite, React 19, TypeScript, WebGL1/2 GLSL, CSS variables (no UI kit).

## Global Constraints

- Photos only; no video/log in v1
- No crop UI/engine; perspective stays
- No Settings screen or nav
- Local-only: no accounts/uploads
- Look: darkroom / cinema still — no monospace tool chrome, no tight grids
- Halation: positional at plus center + radius
- Double exposure blends: Additive, Average, Bright, Dark, Multiply, Overlay (+ Screen/Lighten ok)
- Brand display name: **Nocturne**

## File structure

```
web/
  package.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx
    styles/global.css          # tokens + darkroom base
    state/editStore.ts         # EditParams + defaults + setters
    engine/types.ts            # EditParams types (photo subset)
    engine/shaderSource.ts     # vertex + fragment GLSL strings
    engine/renderer.ts         # WebGL init, textures, draw, export
    engine/blendModes.ts       # Fuji blend mode ids
    components/TopBar.tsx
    components/PreviewStage.tsx
    components/ToolPanel.tsx
    components/Slider.tsx
    components/Section.tsx
    components/tools/LightTools.tsx
    components/tools/ColorTools.tsx
    components/tools/CurvesTools.tsx
    components/tools/HslTools.tsx
    components/tools/PerspectiveTools.tsx
    components/tools/DetailTools.tsx
    components/tools/FilmTools.tsx      # vignette, grain, halation, bokeh
    components/tools/MaskTools.tsx
    components/tools/DoubleExposureTools.tsx
    lib/imageIO.ts             # load file → ImageBitmap; download canvas
```

---

### Task 1: Scaffold `web/` Vite app + darkroom shell

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/tsconfig.app.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles/global.css`, `web/src/vite-env.d.ts`

**Interfaces:**
- Produces: runnable `npm run dev` with empty darkroom layout (top bar + preview region + tool panel chrome)

- [ ] **Step 1:** Create Vite React-TS project files under `web/` (manual write; do not nest another git repo)
- [ ] **Step 2:** Add CSS tokens: `--bg #0c0b0a`, `--surface #161412`, `--text #e8e2d8`, `--muted #9a9186`, `--accent #c4a574` (muted copper); fonts: `"Fraunces"` display + `"Source Sans 3"` UI via Google Fonts link in `index.html`
- [ ] **Step 3:** `App.tsx` layout: `TopBar` placeholder, full-bleed preview area, side `ToolPanel` placeholder; mobile: panel below
- [ ] **Step 4:** `npm install` in `web/`, `npm run build` must succeed
- [ ] **Step 5:** Commit `web/` scaffold

---

### Task 2: EditParams store (photo subset)

**Files:**
- Create: `web/src/engine/types.ts`, `web/src/engine/blendModes.ts`, `web/src/state/editStore.tsx`

**Interfaces:**
- Produces:
  - `EditParams` (light, color, curves, hsl, perspective, detail, vignette, grain, halation, bokeh, masks/gradients simplified, double exposure; **no crop**)
  - `DEFAULT_EDIT_PARAMS`
  - `DoubleExposureBlend = 'additive' | 'average' | 'bright' | 'dark' | 'multiply' | 'overlay' | 'screen' | 'lighten'`
  - React context: `useEditStore()` → `{ params, setParam, patchParams, resetParams, imageUrl, setImageFile, blendImageUrl, setBlendImageFile, error, setError }`

- [ ] **Step 1:** Port simplified types/defaults from `src/core/engine/EditingEngine.ts` (omit crop, long exposure, LUT, video-only fields)
- [ ] **Step 2:** Wire provider in `App.tsx`
- [ ] **Step 3:** Commit

---

### Task 3: WebGL renderer + image IO

**Files:**
- Create: `web/src/lib/imageIO.ts`, `web/src/engine/shaderSource.ts`, `web/src/engine/renderer.ts`, `web/src/components/PreviewStage.tsx`

**Interfaces:**
- Produces:
  - `loadImageFromFile(file: File): Promise<ImageBitmap>`
  - `downloadCanvas(canvas: HTMLCanvasElement, filename: string, type?: 'image/png' | 'image/jpeg')`
  - `class GradeRenderer { constructor(canvas); setImage(bitmap); setBlendImage(bitmap|null); setParams(p: EditParams); resize(); render(); exportToCanvas(maxEdge?: number): HTMLCanvasElement; dispose() }`
- Halation GLSL must multiply glow by spatial falloff from `uHalationCenter` / `uHalationRadius` (not full-frame)
- Double exposure GLSL implements all `DoubleExposureBlend` modes

- [ ] **Step 1:** Implement image load/download helpers
- [ ] **Step 2:** Write vertex + fragment shaders with light/color/halation/grain/vignette/perspective/double-exposure (usable approximations for curves/HSL/detail/bokeh/masks)
- [ ] **Step 3:** `PreviewStage` creates renderer, syncs params + images, shows plus overlay for halation when Film→halation active (parent can pass `showHalationPin`)
- [ ] **Step 4:** Manual check: open image, exposure slider changes preview
- [ ] **Step 5:** Commit

---

### Task 4: Tool UI sections + Open/Export

**Files:**
- Create: `web/src/components/TopBar.tsx`, `web/src/components/ToolPanel.tsx`, `web/src/components/Slider.tsx`, `web/src/components/Section.tsx`, `web/src/components/tools/*.tsx`

**Interfaces:**
- Consumes: `useEditStore`, `GradeRenderer` via preview ref/callback for export
- Produces: working Open, Export, all tool sections from spec (no Settings, no Crop)

- [ ] **Step 1:** `Slider` + `Section` primitives (sentence-case labels, no mono)
- [ ] **Step 2:** Implement each tools file bound to store
- [ ] **Step 3:** `FilmTools`: sub-tabs vignette/grain/halation/bokeh; halation shows center X/Y; PreviewStage shows draggable plus when halation sub-tab active
- [ ] **Step 4:** `DoubleExposureTools`: enable, pick second image, opacity, offset, mode chips (Fuji set)
- [ ] **Step 5:** `MaskTools`: linear + circular gradient enable + exposure/sat/temp offsets (simplified selective masking)
- [ ] **Step 6:** TopBar Open/Export wired; errors inline under top bar
- [ ] **Step 7:** `npm run build` passes; commit

---

### Task 5: Polish + acceptance pass

**Files:**
- Modify: CSS/components as needed

- [ ] **Step 1:** Responsive: panel collapses under preview &lt; 900px
- [ ] **Step 2:** Verify acceptance from spec (halation positional, no crop, no settings, export works)
- [ ] **Step 3:** Final commit

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Vite web SPA | 1 |
| Darkroom UI | 1, 4 |
| EditParams / WebGL | 2, 3 |
| Tools B minus crop | 4 |
| Perspective in | 4 |
| Halation at plus | 3, 4 |
| Fuji double exposure | 2, 3, 4 |
| Local export | 3, 4 |
| No settings/video/crop | enforced by omission |

## Execution

Inline in this session (user requested implement).
