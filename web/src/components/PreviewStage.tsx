import { useEffect, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { GradeRenderer } from '../engine/renderer';
import { useEditStore } from '../state/editStore';
import { VideoTransport } from './VideoTransport';

type Props = {
  rendererRef: MutableRefObject<GradeRenderer | null>;
  /** When true, skip preview frame loop / relayout so export can drive native-size draws. */
  exporting?: boolean;
  /** Sync guard — set true before await so the loop cannot race the React state update. */
  exportingRef?: MutableRefObject<boolean>;
};

type PinDef = {
  id: string;
  x: number;
  y: number;
  title: string;
  onMove: (x: number, y: number) => void;
};

export function PreviewStage({ rendererRef, exporting = false, exportingRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const {
    params,
    imageBitmap,
    blendBitmap,
    hasMedia,
    mediaKind,
    videoEl,
    videoDuration,
    section,
    filmSub,
    patchParams,
    setError,
    activeLutData,
  } = useEditStore();

  const pins: PinDef[] = [];
  const pinMedia = hasMedia;

  if (pinMedia && section === 'film' && filmSub === 'anamorphic') {
    pins.push({
      id: 'anamorphic',
      x: params.longExposureCenter.x,
      y: params.longExposureCenter.y,
      title: 'Streak focus',
      onMove: (x, y) => patchParams({ longExposureCenter: { x, y } }),
    });
  }

  if (pinMedia && section === 'film' && filmSub === 'bokeh') {
    pins.push({
      id: 'bokeh',
      x: params.bokehCenter.x,
      y: params.bokehCenter.y,
      title: 'Focus point',
      onMove: (x, y) => patchParams({ bokehCenter: { x, y } }),
    });
  }

  if (pinMedia && section === 'masks' && params.circularMaskEnabled) {
    pins.push({
      id: 'circ-mask',
      x: params.circularMaskCenter.x,
      y: params.circularMaskCenter.y,
      title: 'Circular mask',
      onMove: (x, y) => patchParams({ circularMaskCenter: { x, y } }),
    });
  }

  if (pinMedia && section === 'masks' && params.linearMaskEnabled) {
    pins.push({
      id: 'lin-mask-a',
      x: params.linearMaskStart.x,
      y: params.linearMaskStart.y,
      title: 'Linear mask start',
      onMove: (x, y) => patchParams({ linearMaskStart: { x, y } }),
    });
    pins.push({
      id: 'lin-mask-b',
      x: params.linearMaskEnd.x,
      y: params.linearMaskEnd.y,
      title: 'Linear mask end',
      onMove: (x, y) => patchParams({ linearMaskEnd: { x, y } }),
    });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const r = new GradeRenderer(canvas);
      rendererRef.current = r;
      return () => {
        r.dispose();
        rendererRef.current = null;
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL failed to start.');
    }
  }, [rendererRef, setError]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r || !imageBitmap || mediaKind === 'video') return;
    r.setImage(imageBitmap);
  }, [imageBitmap, mediaKind, rendererRef]);

  useEffect(() => {
    if (exporting || exportingRef?.current) return;
    rendererRef.current?.setBlendImage(blendBitmap);
  }, [blendBitmap, rendererRef, exporting, exportingRef]);

  useEffect(() => {
    if (exporting || exportingRef?.current) return;
    const r = rendererRef.current;
    if (!r) return;
    r.setLut(activeLutData, 33);
  }, [activeLutData, rendererRef, exporting, exportingRef]);

  useEffect(() => {
    if (exporting || exportingRef?.current) return;
    rendererRef.current?.setParams(params);
  }, [params, rendererRef, exporting, exportingRef]);

  useEffect(() => {
    if (exporting || mediaKind !== 'video' || !videoEl) return;

    let cancelled = false;
    let rafId = 0;
    let rvfcId: number | null = null;
    const video = videoEl;
    const useRvfc = typeof video.requestVideoFrameCallback === 'function';

    const drawFrame = () => {
      if (cancelled || document.hidden || exportingRef?.current) return;
      const r = rendererRef.current;
      if (!r) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      r.setVideoFrame(video);
      r.render();
    };

    const scheduleRvfc = () => {
      rvfcId = video.requestVideoFrameCallback(() => {
        if (cancelled) return;
        drawFrame();
        scheduleRvfc();
      });
    };

    const scheduleRaf = () => {
      rafId = requestAnimationFrame(() => {
        if (cancelled) return;
        drawFrame();
        scheduleRaf();
      });
    };

    const onSeeked = () => drawFrame();
    const onLoadedData = () => drawFrame();
    const onVisibility = () => {
      if (!document.hidden) drawFrame();
    };

    video.addEventListener('seeked', onSeeked);
    video.addEventListener('loadeddata', onLoadedData);
    document.addEventListener('visibilitychange', onVisibility);

    drawFrame();
    if (useRvfc) scheduleRvfc();
    else scheduleRaf();

    return () => {
      cancelled = true;
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('loadeddata', onLoadedData);
      document.removeEventListener('visibilitychange', onVisibility);
      if (rvfcId != null && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(rvfcId);
      }
      cancelAnimationFrame(rafId);
    };
  }, [exporting, mediaKind, videoEl, rendererRef, exportingRef]);

  useEffect(() => {
    if (exporting) return;
    const stage = stageRef.current;
    if (!stage) return;

    const relayout = () => {
      if (exportingRef?.current) return;
      rendererRef.current?.render();
    };
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(relayout)
      : null;
    ro?.observe(stage);

    window.addEventListener('resize', relayout);
    window.visualViewport?.addEventListener('resize', relayout);
    window.visualViewport?.addEventListener('scroll', relayout);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', relayout);
      window.visualViewport?.removeEventListener('resize', relayout);
      window.visualViewport?.removeEventListener('scroll', relayout);
    };
  }, [exporting, rendererRef, exportingRef]);

  const onPinPointer = (pin: PinDef) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const frame = e.currentTarget.parentElement;
    if (!frame) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const rect = frame.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
      pin.onMove(x, y);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    move(e.nativeEvent);
  };

  return (
    <section className="stage" ref={stageRef}>
      {!hasMedia && (
        <div className="stage-empty">
          <h2>Open a still</h2>
          <p>Grade locally in the browser. Nothing leaves your device.</p>
        </div>
      )}
      <div className="stage-frame" style={{ display: hasMedia ? 'block' : 'none' }}>
        <canvas ref={canvasRef} />
        {pins.map((pin) => (
          <div
            key={pin.id}
            className="hal-pin"
            style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
            onPointerDown={onPinPointer(pin)}
            title={pin.title}
          />
        ))}
        {mediaKind === 'video' && (
          <button
            type="button"
            className={`color-badge${params.logToRec709 ? ' is-on' : ''}`}
            aria-pressed={params.logToRec709}
            title={
              params.logToRec709
                ? 'Log → Rec.709 is on (tap to turn off)'
                : 'Tap to convert log footage to Rec.709'
            }
            onClick={() => patchParams({ logToRec709: !params.logToRec709 })}
          >
            Log → Rec.709
          </button>
        )}
      </div>
      {mediaKind === 'video' && videoEl && !exporting && (
        <VideoTransport video={videoEl} duration={videoDuration} />
      )}
    </section>
  );
}
