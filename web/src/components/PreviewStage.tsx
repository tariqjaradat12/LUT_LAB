import { useEffect, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { GradeRenderer } from '../engine/renderer';
import { useEditStore } from '../state/editStore';

type Props = {
  rendererRef: MutableRefObject<GradeRenderer | null>;
};

type PinDef = {
  id: string;
  x: number;
  y: number;
  title: string;
  onMove: (x: number, y: number) => void;
};

export function PreviewStage({ rendererRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const { params, imageBitmap, blendBitmap, hasImage, section, filmSub, patchParams, setError, activeLutData } =
    useEditStore();

  const pins: PinDef[] = [];

  if (hasImage && section === 'film' && filmSub === 'halation') {
    pins.push({
      id: 'halation',
      x: params.halationCenter.x,
      y: params.halationCenter.y,
      title: 'Halation',
      onMove: (x, y) => patchParams({ halationCenter: { x, y } }),
    });
  }

  if (hasImage && section === 'film' && filmSub === 'anamorphic') {
    pins.push({
      id: 'anamorphic',
      x: params.longExposureCenter.x,
      y: params.longExposureCenter.y,
      title: 'Anamorphic streaks',
      onMove: (x, y) => patchParams({ longExposureCenter: { x, y } }),
    });
  }

  if (hasImage && section === 'film' && filmSub === 'bokeh') {
    pins.push({
      id: 'bokeh',
      x: params.bokehCenter.x,
      y: params.bokehCenter.y,
      title: 'Focus point',
      onMove: (x, y) => patchParams({ bokehCenter: { x, y } }),
    });
  }

  if (hasImage && section === 'masks' && params.circularMaskEnabled) {
    pins.push({
      id: 'circ-mask',
      x: params.circularMaskCenter.x,
      y: params.circularMaskCenter.y,
      title: 'Circular mask',
      onMove: (x, y) => patchParams({ circularMaskCenter: { x, y } }),
    });
  }

  if (hasImage && section === 'masks' && params.linearMaskEnabled) {
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
    if (!r || !imageBitmap) return;
    r.setImage(imageBitmap);
  }, [imageBitmap, rendererRef]);

  useEffect(() => {
    rendererRef.current?.setBlendImage(blendBitmap);
  }, [blendBitmap, rendererRef]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setLut(activeLutData, 33);
  }, [activeLutData, rendererRef]);

  useEffect(() => {
    rendererRef.current?.setParams(params);
  }, [params, rendererRef]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const relayout = () => rendererRef.current?.render();
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
  }, [rendererRef]);

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
      {!hasImage && (
        <div className="stage-empty">
          <h2>Open a still</h2>
          <p>Grade locally in the browser. Nothing leaves your device.</p>
        </div>
      )}
      <div className="stage-frame" style={{ display: hasImage ? 'block' : 'none' }}>
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
      </div>
    </section>
  );
}
