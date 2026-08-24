# Web Photo Editor — Design Spec

**Date:** 2026-08-24  
**Status:** Approved for planning  
**Product direction:** Replace the React Native Android/iOS app with a local-first website for photo editing in desktop and mobile browsers (Chrome, Edge, Safari, etc.).

---

## Goals

- Ship a browser photo editor that does not look “vibecoded” (no terminal chrome, monospace technical labels, or tight grid-line pro UI).
- Visual direction: **darkroom / cinema still** — deep neutrals, soft contrast, editorial product name, quiet controls, image as hero.
- Fully **local**: import → edit → download; no accounts, uploads, or cloud saves in v1.
- Port the useful photo grading/FX experience from the current app; drop Settings and video for now.
- Fix **halation** so it follows the plus/center point (not a full-frame wash).
- Expand **double exposure** toward Fujifilm-style blend modes.

## Non-goals (v1)

- Video / log conversion / log slider audit (deferred until a later video phase).
- Crop UI or crop engine (explicitly excluded; sluggish and out of scope).
- Settings tab/screen and personalization hub (removed entirely).
- Community / publish / accounts / sync.
- Camera capture.
- Keeping the React Native app as a shipping product (web replaces it; native code remains only as reference while porting).

## Architecture

| Piece | Choice |
|--------|--------|
| App | New `web/` Vite + React + TypeScript SPA |
| Preview | WebGL canvas driven by a shared `EditParams` state object |
| Persistence | None (session-only in memory) |
| Backend | None |
| Native RN/Android/iOS | Reference only; not the product |

**Pipeline:** image file → decode → GPU texture → WebGL grade/FX → on-screen preview → client-side PNG/JPEG export.

**Repo:** Add `web/` alongside existing native trees. Do not invest in new RN features.

## UI

- **Desktop:** Full-bleed preview; slim top bar (brand, Open, Export); calm side panel for tools.
- **Mobile web:** Preview on top; bottom sheet / simple tabs for tools.
- **Typography:** Product name can use expressive/editorial type; tool labels use a clean proportional sans — never monospace ALL-CAPS tech styling.
- **Color:** Near-black canvas, warm soft-gray text, one restrained accent (amber or muted copper — not neon purple/glow).
- **No Settings** entry anywhere in navigation.

### Tool sections (v1)

1. Light  
2. Color  
3. Curves (bezier)  
4. HSL (8-band)  
5. Perspective (keep; **not** crop)  
6. Detail  
7. Lens & Film — vignette, grain, **positional halation**, bokeh  
8. Selective masking  
9. Double exposure  

## Feature details

### Halation

- Positional: strength/glow concentrates around the **plus / center** (`halationCenter`) and **radius**, not the whole image.
- User can move the plus to retarget the effect.
- Controls: strength, radius, color, center position (existing mental model, corrected behavior).

### Double exposure (Fujifilm-oriented)

- Second photo via file picker.
- Opacity + X/Y offset.
- Blend modes expanded toward camera-style options, including at least: **Additive, Average, Bright, Dark, Multi(ply), Overlay**, and retain useful extras such as Screen / Lighten where they still read clearly in UI.
- Mode names should be plain and camera-like, not developer jargon.

### Export

- Render current grade to canvas and download.
- PNG default; JPEG optional if cheap to add.
- Preview may downscale very large images for responsiveness; export uses the best practical resolution without locking the tab.

### Errors

- Inline, calm messages: unsupported type, decode failure, WebGL unavailable.
- No crash dumps or settings screens.

## Data flow

```
UI controls  →  EditParams store  →  WebGL uniforms / textures  →  Preview
                                      └→ Export render pass → download
```

Port/simplify parameter shapes from the current `EditingEngine` / shader uniforms where they map cleanly. Reimplement GPU work in GLSL for WebGL; do not call native modules.

## Testing / acceptance (v1)

- Open a JPEG/PNG, adjust Light/Color, see live preview update.
- Halation glow tracks the plus position and radius (not full-frame).
- Double exposure applies with Fuji-like modes and opacity/offset.
- Perspective controls work; **no crop UI** present.
- Settings route/screen absent.
- Export downloads a graded still.
- Layout readable on a desktop browser and a phone-sized viewport.
- Visual check: no monospace tool chrome, no dense terminal grid aesthetic.

## Later (explicitly after v1)

- Video + log conversion quality pass (including dark log look / weak sliders).
- Optional crop (only if redesigned to be lightweight).
- Optional accounts / cloud projects.
- Marketing pages / hosting polish (can stay static host of the Vite build).

## Decision summary

| Topic | Decision |
|--------|----------|
| Platform | Web replaces native app |
| Stack | Vite + React + TS + WebGL |
| Media | Photos only |
| Auth | None (local-only) |
| Look | Darkroom / cinema still |
| Crop | Out |
| Perspective | In |
| Settings | Removed |
| Halation | Positional at plus |
| Double exposure | Fuji-style modes |
| Log video fixes | Deferred |
