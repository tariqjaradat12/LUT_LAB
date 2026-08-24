import { useCallback, useRef } from 'react';

type Props = {
  colorOffset: number;
  toneOffset: number;
  onValuesChange: (colorOffset: number, toneOffset: number) => void;
};

export function LutCustomizerPad({ colorOffset, toneOffset, onValuesChange }: Props) {
  const padRef = useRef<HTMLDivElement>(null);

  const updateFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const touchX = Math.min(rect.width, Math.max(0, clientX - rect.left));
      const touchY = Math.min(rect.height, Math.max(0, clientY - rect.top));
      const nextColor = Math.round((touchX / rect.width) * 200 - 100);
      const nextTone = Math.round((1 - touchY / rect.height) * 200 - 100);
      onValuesChange(nextColor, nextTone);
    },
    [onValuesChange],
  );

  const xPercent = (colorOffset + 100) / 200;
  const yPercent = 1 - (toneOffset + 100) / 200;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClient(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    updateFromClient(e.clientX, e.clientY);
  };

  return (
    <div className="lut-pad-wrap">
      <div className="lut-pad-labels">
        <span>Warm</span>
        <span>Cool</span>
      </div>
      <div
        ref={padRef}
        className="lut-pad"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <div className="lut-pad-grid" aria-hidden />
        <div
          className="lut-pad-cross lut-pad-cross-v"
          style={{ left: `${xPercent * 100}%` }}
        />
        <div
          className="lut-pad-cross lut-pad-cross-h"
          style={{ top: `${yPercent * 100}%` }}
        />
        <div
          className="lut-pad-handle"
          style={{ left: `${xPercent * 100}%`, top: `${yPercent * 100}%` }}
        />
      </div>
      <div className="lut-pad-labels lut-pad-labels-v">
        <span>Bright</span>
        <span>Dark</span>
      </div>
      <div className="lut-pad-values">
        <span>Color {colorOffset > 0 ? '+' : ''}{colorOffset}</span>
        <span>Tone {toneOffset > 0 ? '+' : ''}{toneOffset}</span>
      </div>
    </div>
  );
}
