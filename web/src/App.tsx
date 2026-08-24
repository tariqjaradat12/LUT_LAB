import { useRef } from 'react';
import { TopBar } from './components/TopBar';
import { PreviewStage } from './components/PreviewStage';
import { ToolPanel } from './components/ToolPanel';
import { useEditStore } from './state/editStore';
import type { GradeRenderer } from './engine/renderer';
import { downloadCanvas } from './lib/imageIO';

export default function App() {
  const { error, setError, hasImage } = useEditStore();
  const rendererRef = useRef<GradeRenderer | null>(null);

  const onExport = () => {
    try {
      if (!hasImage || !rendererRef.current) return;
      const canvas = rendererRef.current.exportToCanvas();
      downloadCanvas(canvas, 'nocturne-export.png');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    }
  };

  return (
    <div className="app">
      <TopBar onExport={onExport} />
      {error && <div className="error-banner">{error}</div>}
      <PreviewStage rendererRef={rendererRef} />
      <ToolPanel />
    </div>
  );
}
