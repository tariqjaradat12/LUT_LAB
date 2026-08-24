import { useEffect, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { GradeRenderer } from '../engine/renderer';
import { useEditStore } from '../state/editStore';

type Props = {
  rendererRef: MutableRefObject<GradeRenderer | null>;
};

export function PreviewStage({ rendererRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { params, imageBitmap, blendBitmap, hasImage, section, filmSub, patchParams, setError } =
    useEditStore();
  const showPin = hasImage && section === 'film' && filmSub === 'halation';

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

  const onPinPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const stage = e.currentTarget.parentElement;
    if (!stage) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height));
      patchParams({ halationCenter: { x, y } });
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
      {showPin && (
        <div
          className="hal-pin"
          style={{
            left: `${params.halationCenter.x * 100}%`,
            top: `${params.halationCenter.y * 100}%`,
          }}
          onPointerDown={onPinPointer}
          title="Halation center"
        />
      )}
    </section>
  );
}
