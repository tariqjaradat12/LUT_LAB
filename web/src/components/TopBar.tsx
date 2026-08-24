import { useEditStore } from '../state/editStore';

type Props = {
  onExport: () => void;
};

export function TopBar({ onExport }: Props) {
  const { openImage, hasImage, resetParams } = useEditStore();

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
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openImage(f);
              e.target.value = '';
            }}
          />
        </label>
        <button type="button" className="btn" disabled={!hasImage} onClick={resetParams}>
          Reset
        </button>
        <button type="button" className="btn btn-primary" disabled={!hasImage} onClick={onExport}>
          Export
        </button>
      </div>
    </header>
  );
}
