import { useEffect, useRef, useState } from 'react';
import { defaultCurve, type CurveChannelId, type CurvePoint } from '../engine/types';

const CHANNELS: { id: CurveChannelId; label: string; color: string }[] = [
  { id: 'rgb', label: 'White', color: '#e8e2d8' },
  { id: 'r', label: 'Red', color: '#d96a5b' },
  { id: 'g', label: 'Green', color: '#6aaf7a' },
  { id: 'b', label: 'Blue', color: '#6a8fd9' },
];

type Props = {
  curves: Record<CurveChannelId, CurvePoint[]>;
  onChange: (channel: CurveChannelId, points: CurvePoint[]) => void;
};

function hitRadius() {
  if (typeof window === 'undefined') return 0.12;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return coarse ? 0.2 : 0.12;
}

export function CurveEditor({ curves, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [channel, setChannel] = useState<CurveChannelId>('rgb');
  const [layoutTick, setLayoutTick] = useState(0);
  const dragIndex = useRef<number | null>(null);
  const points = curves[channel].length >= 5 ? curves[channel] : defaultCurve();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setLayoutTick((n) => n + 1));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(1, canvas.clientWidth || 180);
    const cssH = Math.max(1, canvas.clientHeight || cssW);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = cssW;
    const H = cssH;
    ctx.fillStyle = '#12100e';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(232,226,216,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const tx = (i / 4) * W;
      const ty = (i / 4) * H;
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx, H);
      ctx.moveTo(0, ty);
      ctx.lineTo(W, ty);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(232,226,216,0.14)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(W, 0);
    ctx.stroke();

    const meta = CHANNELS.find((c) => c.id === channel)!;
    const handleR = Math.max(6, Math.min(W, H) * 0.035);

    ctx.strokeStyle = meta.color;
    ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.008);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = p.x * W;
      const y = (1 - p.y) * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * W, (1 - p.y) * H, handleR, 0, Math.PI * 2);
      ctx.fillStyle = meta.color;
      ctx.fill();
      ctx.strokeStyle = '#0c0b0a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [points, channel, layoutTick]);

  const toNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / w)),
      y: Math.min(1, Math.max(0, 1 - (e.clientY - rect.top) / h)),
    };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const n = toNorm(e);
    let best = 0;
    let bestD = 1;
    points.forEach((p, i) => {
      const d = Math.hypot(p.x - n.x, p.y - n.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    dragIndex.current = bestD < hitRadius() ? best : null;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (dragIndex.current != null) {
      const i = dragIndex.current;
      onChange(
        channel,
        points.map((p, idx) => (idx === i ? { x: p.x, y: n.y } : p)),
      );
    }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragIndex.current == null) return;
    e.preventDefault();
    const n = toNorm(e);
    const i = dragIndex.current;
    onChange(
      channel,
      points.map((p, idx) => (idx === i ? { x: p.x, y: n.y } : p)),
    );
  };

  return (
    <div className="curve-editor">
      <div className="chip-row curve-channels">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip${channel === c.id ? ' active' : ''}`}
            onClick={() => setChannel(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className="curve-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => {
          dragIndex.current = null;
        }}
        onPointerCancel={() => {
          dragIndex.current = null;
        }}
      />
      <button
        type="button"
        className="btn"
        style={{ marginTop: '0.5rem' }}
        onClick={() => onChange(channel, defaultCurve())}
      >
        Reset curve
      </button>
    </div>
  );
}
