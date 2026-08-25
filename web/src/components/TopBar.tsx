import { useEditStore } from '../state/editStore';

type Props = {
  onExport: () => void;
  exporting?: boolean;
};

export function TopBar({ onExport, exporting = false }: Props) {
  const { openMedia, hasMedia, resetParams } = useEditStore();

  return (
    <header className="topbar">
      <div className="brand">
        Lut Lab
      </div>
      <div className="top-actions">
        <label className="btn file-btn">
          Open
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            disabled={exporting}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openMedia(f);
              e.target.value = '';
            }}
          />
        </label>
        <button type="button" className="btn" disabled={!hasMedia || exporting} onClick={resetParams}>
          Reset
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!hasMedia || exporting}
          onClick={onExport}
        >
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>
    </header>
  );
}
