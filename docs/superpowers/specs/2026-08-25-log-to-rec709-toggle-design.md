# Log → Rec.709 toggle + 30fps export — Design

**Date:** 2026-08-25  
**Status:** Approved in chat (generic curve + toggle)

## Goals
- Toggle **Log → Rec.709** on/off for video (default off).
- One generic log decode (S-Log3-style) → linear → Rec.709 OETF in the WebGL shader (preview + export).
- Fix ~5fps exports by decoding frames in order (not HTMLVideoElement keyframe seeks).

## Non-goals
- Per-camera curve pickers (S-Log3 / V-Log / F-Log as separate modes).
- Changing photo grading behavior.

## UX
- Video stage control: button/toggle labeled `Log → Rec.709` (active state when on).
- When off: passthrough (current behavior).
- When on: conversion applied before the rest of the grade stack.

## Export
- Prefer Mediabunny `VideoSampleSink` → grade canvas → `CanvasSource` at true timestamps.
- Keep MediaRecorder fallback with primed first frame.
