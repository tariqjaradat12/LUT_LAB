import { FILM_PRESET_META, getLutDisplayName } from '../lib/lutPresets';
import { useEditStore } from '../state/editStore';
import { LutCustomizerPad } from './LutCustomizerPad';

export function LutLooksPanel() {
  const {
    params, setParam, patchParams,
    importedLuts, activeLutId, importLutFile, selectLut, removeLut,
    presetLuts, presetsLoading,
  } = useEditStore();

  const activeName = getLutDisplayName(activeLutId, presetLuts, importedLuts);

  return (
    <div className="lut-looks">
      <header className="lut-looks-head">
        <p className="lut-looks-kicker">Looks</p>
        <label className="lut-looks-import">
          Import
          <input
            type="file"
            accept=".cube,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importLutFile(f);
              e.target.value = '';
            }}
          />
        </label>
      </header>

      {presetsLoading ? (
        <p className="lut-looks-status">Building film looks…</p>
      ) : (
        <div className="lut-looks-scroll">
          {(['Fujifilm', 'Kodak'] as const).map((group) => (
            <section key={group} className="lut-looks-group">
              <h3 className="lut-looks-group-title">{group}</h3>
              <ul className="lut-looks-list">
                {FILM_PRESET_META.filter((p) => p.group === group).map((meta) => {
                  const active = activeLutId === meta.id;
                  return (
                    <li key={meta.id}>
                      <button
                        type="button"
                        className={`lut-look${active ? ' is-active' : ''}`}
                        onClick={() => selectLut(meta.id)}
                      >
                        <span className="lut-look-name">{meta.name}</span>
                        {active && <span className="lut-look-mark" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {importedLuts.length > 0 && (
            <section className="lut-looks-group">
              <h3 className="lut-looks-group-title">Yours</h3>
              <ul className="lut-looks-list">
                {importedLuts.map((lut) => {
                  const active = activeLutId === lut.id;
                  return (
                    <li key={lut.id}>
                      <button
                        type="button"
                        className={`lut-look${active ? ' is-active' : ''}`}
                        onClick={() => selectLut(lut.id)}
                      >
                        <span className="lut-look-name">{lut.name}</span>
                        {active && <span className="lut-look-mark" aria-hidden />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {activeLutId && (
        <div className="lut-looks-studio">
          <div className="lut-looks-studio-bar">
            <span className="lut-looks-studio-title">{activeName}</span>
            <div className="lut-looks-studio-actions">
              {!activeLutId.startsWith('preset_') && (
                <button type="button" className="lut-looks-text-btn" onClick={() => removeLut(activeLutId)}>
                  Remove
                </button>
              )}
              <button type="button" className="lut-looks-text-btn" onClick={() => selectLut(null)}>
                Off
              </button>
            </div>
          </div>

          <LutCustomizerPad
            colorOffset={params.lutColorOffset}
            toneOffset={params.lutToneOffset}
            onValuesChange={(colorOffset, toneOffset) =>
              patchParams({ lutColorOffset: colorOffset, lutToneOffset: toneOffset })
            }
          />

          <div className="lut-looks-mix">
            <div className="lut-looks-mix-head">
              <span>Mix</span>
              <span>{Math.round(params.lutIntensity)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={params.lutIntensity}
              onChange={(e) => setParam('lutIntensity', Number(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
