# Final Fix Report: Lock transport during video export

**Branch:** `feature/web-video-rec709`  
**Date:** 2026-08-25

## Summary

Addressed Critical/Important findings from the final review so export cannot hang on a missing `ended` event and so grade/layout updates cannot fight the native-size recorder.

## Fixes

1. **CRITICAL — Hide VideoTransport while exporting**  
   `PreviewStage` no longer renders `VideoTransport` when `exporting` is true, so the user cannot pause/scrub the shared video mid-record (pause would prevent `ended` and hang export).

2. **IMPORTANT — Skip grade mutations that call `render()` / `fitToStage` during export**  
   `PreviewStage` effects for `setLut`, `setBlendImage`, and `setParams` early-return when `exporting` / `exportingRef.current`.  
   `ToolPanel` receives `exporting` from `App` and sets `pointer-events: none` so controls cannot change grade mid-export.

3. **IMPORTANT — Stop unused captureStream video tracks**  
   In `videoExport.tryAddAudioTracks`, after copying audio tracks onto the canvas stream, stop the element capture’s video tracks immediately.

## Verification

```text
cd web; npm run build
✓ tsc + vite build — exit 0
```
