# Web Video Editing (Rec.709) — Design Spec

**Date:** 2026-08-25  
**Status:** Approved for planning  
**Product:** Lut Lab (browser photo/video grader)

---

## Goals

- Add **local video** open → live grade → export alongside the existing photo workflow.
- Treat footage as **display-referred Rec.709** for this phase (no log decode).
- Reuse the current WebGL grading pipeline (tools + LUTs) at **native resolution** (no downscale).
- Export a graded video file via **Canvas + MediaRecorder**.
- Hard-cap export at **15 minutes**; show a clear error if the clip is longer.

## Non-goals (this phase)

- Log → Rec.709 decode (S-Log3, V-Log, F-Log, C-Log, etc.) — deferred; UI may show a Rec.709 badge only.
- Trim / cut / multi-clip timeline.
- Guaranteed MP4 on every browser (prefer WebM; use MP4 only when `MediaRecorder` supports it).
- Cloud upload, accounts, or server processing.
- Changing the existing photo path or LUTs Looks UI beyond what’s needed for shared Open/Export.

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Pipeline | Full: open → grade → export file |
| Color | Rec.709 only (passthrough / display-referred) |
| Capture method | Canvas stream + `MediaRecorder` |
| Resolution | Native width × height; **no downscale** |
| Export duration limit | **15 minutes** hard cap |
| Preview of longer clips | Allowed; export blocked with message |

## User experience

### Open
- Top-bar **Open** accepts images and video (`video/mp4`, `video/webm`, `video/quicktime` where playable).
- On open: clear prior media, reset edit params (same as photo), load clip into a hidden or offscreen `<video>` + WebGL texture path.

### Preview
- Same stage as photos; each animation frame samples the current video frame into the existing `GradeRenderer`.
- Transport under the stage (video only): play/pause, current/duration time, scrubber.
- Small **Rec.709** badge when video is loaded (signals color mode; future log picker can replace this).

### Tools / LUTs
- All existing tool tabs and LUT Looks apply to the live video frame the same way they apply to stills.
- No separate “video tools” tab in this phase.

### Export
- **Export** while a video is loaded starts a graded recording pass:
  - Seek to start (or play from current policy: **always from 0** for a full-clip export).
  - Draw graded frames to a canvas sized to **source width × height**.
  - `canvas.captureStream` + `MediaRecorder`; mux **audio** from the source element when the browser allows (best-effort; silent export if blocked).
  - Prefer `video/webm;codecs=vp9` or `vp8`; fall back to whatever `MediaRecorder.isTypeSupported` allows (including MP4 if present).
- If `duration > 15 * 60` seconds: **do not start** export; show an error banner explaining the 15‑minute limit.
- Progress: simple status (e.g. “Exporting… 32%”) in the UI; cancel optional if cheap to add, otherwise document that closing the tab aborts.
- Filename: e.g. `lut-lab-export.webm` / `.mp4` matching the chosen MIME type.

### Photos
- Unchanged behavior when an image is open (including JPEG export).

## Architecture

```
Open file
  ├─ image/*  → ImageBitmap → GradeRenderer (existing)
  └─ video/*  → HTMLVideoElement → requestVideoFrameCallback / rAF
                    → texImage2D each frame → GradeRenderer
Export video
  → native-size canvas + MediaRecorder(canvas stream [+ audio])
  → Blob download
```

### State additions (conceptual)
- `mediaKind: 'image' | 'video' | null`
- `videoElement` / object URL lifecycle (revoke on replace/clear)
- `colorSpace: 'rec709'` (fixed for now)
- Transport: `playing`, `currentTime`, `duration`
- Export: `exporting`, `exportProgress`, block if duration > 900s

### Renderer
- Extend or wrap `GradeRenderer` to accept video frames (texture upload from `HTMLVideoElement`) without changing shader math for Rec.709.
- Export path must **not** call stage `fitToStage` resize that shrinks the buffer (same class of bug already fixed for photo export).

## Limits & failure modes

| Case | Behavior |
|------|----------|
| Duration > 15:00 | Export refused; message shown |
| Codec not playable | Open fails with clear error |
| `MediaRecorder` unsupported | Export fails with clear error |
| Audio capture blocked | Video-only export still succeeds |
| Tab backgrounded mid-export | May stall; document as browser limitation |

## Success criteria

1. User can open a short MP4/WebM, grade with tools/LUTs, play/scrub, and download a graded file at **native resolution**.
2. Clips longer than 15 minutes cannot be exported; UI explains why.
3. Photo open/export still works.
4. No silent downscale anywhere in the video path.

## Follow-ups (not this phase)

- Log format picker → linear → Rec.709 encode in the shader.
- Stronger export (WebCodecs), cancel button, bitrate controls.
- Trim in/out points under the 15‑minute cap.

---

## Approval

Approved in chat (2026-08-25): Approach A (MediaRecorder), Rec.709-only color, no downscale, 15‑minute export hard cap.
