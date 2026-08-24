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
  const { params, imageBitmap, blendBitmap, hasImage, section, filmSub, patchParams, setError } =
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
    rendererRef.current?.setParams(params);
  }, [params, rendererRef]);

  useEffect(() => {
    const onResize = () => rendererRef.current?.render();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [rendererRef]);

  const onPinPointer = (pin: PinDef) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const stage = e.currentTarget.parentElement;
    if (!stage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
      pin.onMove(x, y);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    move(e.nativeEvent);
  };

  return (
    <section className="stage">
      {!hasImage && (
        <div className="stage-empty">
          <h2>Open a still</h2>
          <p>Grade locally in the browser. Nothing leaves your device.</p>
        </div>
      )}
      <canvas ref={canvasRef} style={{ opacity: hasImage ? 1 : 0 }} />
      {pins.map((pin) => (
        <div
          key={pin.id}
          className="hal-pin"
          style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
          onPointerDown={onPinPointer(pin)}
          title={pin.title}
        />
      ))}
    </section>
  );
}
