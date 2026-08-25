import { useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { PreviewStage } from './components/PreviewStage';
import { ToolPanel } from './components/ToolPanel';
import { useEditStore } from './state/editStore';
import type { GradeRenderer } from './engine/renderer';
import { downloadBlob, downloadCanvas } from './lib/imageIO';
import { canExportDuration } from './lib/videoIO';
import { exportGradedVideo } from './lib/videoExport';

export default function App() {
  const {
    error,
    setError,
    hasMedia,
    mediaKind,
    videoEl,
    videoDuration,
    videoSourceBytes,
    params,
  } = useEditStore();
  const rendererRef = useRef<GradeRenderer | null>(null);
  const exportingRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  const onExport = async () => {
    try {
      if (!hasMedia || !rendererRef.current || exportingRef.current) return;
      setError(null);

      if (mediaKind === 'video') {
        if (!videoEl) return;
        if (!canExportDuration(videoDuration)) {
          setError('Export is limited to clips of 15 minutes or less.');
          return;
        }
        exportingRef.current = true;
        setExporting(true);
        setExportProgress(0);
        const blob = await exportGradedVideo({
          video: videoEl,
          renderer: rendererRef.current,
          params,
          sourceByteSize: videoSourceBytes,
          onProgress: (t) => {
            if (videoDuration > 0) {
              setExportProgress(Math.min(100, (t / videoDuration) * 100));
            }
          },
        });
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        downloadBlob(blob, `lut-lab-export.${ext}`);
      } else {
        const canvas = rendererRef.current.exportToCanvas();
        downloadCanvas(canvas, 'lut-lab-export.jpg');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      exportingRef.current = false;
      setExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="app">
      <div className="app-chrome">
        <TopBar onExport={() => void onExport()} exporting={exporting} />
        {exporting && (
          <div className="export-banner">
            Exporting…
            {exportProgress != null && ` ${Math.round(exportProgress)}%`}
          </div>
        )}
        {error && !exporting && <div className="error-banner">{error}</div>}
      </div>
      <PreviewStage
        rendererRef={rendererRef}
        exporting={exporting}
        exportingRef={exportingRef}
      />
      <ToolPanel exporting={exporting} />
    </div>
  );
}
