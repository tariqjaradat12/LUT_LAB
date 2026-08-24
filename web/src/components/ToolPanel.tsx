import { BLEND_MODES, type HueBand, type ToolSection } from '../engine/types';
import { useEditStore } from '../state/editStore';
import { Slider, Toggle } from './Slider';

const SECTIONS: { id: ToolSection; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'color', label: 'Color' },
  { id: 'curves', label: 'Curves' },
  { id: 'hsl', label: 'HSL' },
  { id: 'perspective', label: 'Perspective' },
  { id: 'detail', label: 'Detail' },
  { id: 'film', label: 'Lens & Film' },
  { id: 'masks', label: 'Masks' },
  { id: 'double', label: 'Double exposure' },
];

const HUE_BANDS: HueBand[] = [
  'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta',
];

const pct = (v: number) => `${Math.round(v)}`;
const ev = (v: number) => `${v.toFixed(2)} EV`;

export function ToolPanel() {
  const {
    params, setParam, patchParams, section, setSection, filmSub, setFilmSub,
    openBlendImage, clearBlend, blendBitmap,
  } = useEditStore();

  return (
    <aside className="panel">
      <nav className="section-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`section-tab${section === s.id ? ' active' : ''}`}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="panel-body">
        {section === 'light' && (
          <>
            <Slider label="Exposure" value={params.exposure} min={-4} max={4} step={0.05} onChange={(v) => setParam('exposure', v)} format={ev} />
            <Slider label="Brightness" value={params.brightness} min={-100} max={100} onChange={(v) => setParam('brightness', v)} format={pct} />
            <Slider label="Contrast" value={params.contrast} min={-100} max={100} onChange={(v) => setParam('contrast', v)} format={pct} />
            <Slider label="Highlights" value={params.highlights} min={-100} max={100} onChange={(v) => setParam('highlights', v)} format={pct} />
            <Slider label="Shadows" value={params.shadows} min={-100} max={100} onChange={(v) => setParam('shadows', v)} format={pct} />
          </>
        )}

        {section === 'color' && (
          <>
            <Slider label="Saturation" value={params.saturation} min={-100} max={100} onChange={(v) => setParam('saturation', v)} format={pct} />
            <Slider label="Vibrance" value={params.vibrance} min={-100} max={100} onChange={(v) => setParam('vibrance', v)} format={pct} />
            <Slider label="Temperature" value={params.temperature} min={-100} max={100} onChange={(v) => setParam('temperature', v)} format={pct} />
            <Slider label="Tint" value={params.tint} min={-100} max={100} onChange={(v) => setParam('tint', v)} format={pct} />
            <Slider label="Hue" value={params.hue} min={-180} max={180} onChange={(v) => setParam('hue', v)} />
            <Toggle label="Black & white" value={params.bwEnabled} onChange={(v) => setParam('bwEnabled', v)} />
          </>
        )}

        {section === 'curves' && (
          <>
            <p className="hint">RGB tone curve anchors (shadow → highlight).</p>
            {([0, 1, 2, 3, 4] as const).map((i) => (
              <Slider
                key={i}
                label={['Blacks', 'Shadows', 'Midtones', 'Highlights', 'Whites'][i]}
                value={params.curves.rgb[i].y}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => {
                  const rgb = params.curves.rgb.map((p, idx) => (idx === i ? { ...p, y: v } : p));
                  setParam('curves', { ...params.curves, rgb });
                }}
                format={(v) => v.toFixed(2)}
              />
            ))}
          </>
        )}

        {section === 'hsl' && (
          <>
            <p className="hint">Per-band saturation (full HSL wheels can deepen later).</p>
            {HUE_BANDS.map((band) => (
              <Slider
                key={band}
                label={`${band[0].toUpperCase()}${band.slice(1)} saturation`}
                value={params.hsl[band].saturation}
                min={-100}
                max={100}
                onChange={(v) =>
                  setParam('hsl', {
                    ...params.hsl,
                    [band]: { ...params.hsl[band], saturation: v },
                  })
                }
                format={pct}
              />
            ))}
          </>
        )}

        {section === 'perspective' && (
          <>
            <Slider label="Vertical" value={params.perspectiveVertical} min={-100} max={100} onChange={(v) => setParam('perspectiveVertical', v)} format={pct} />
            <Slider label="Horizontal" value={params.perspectiveHorizontal} min={-100} max={100} onChange={(v) => setParam('perspectiveHorizontal', v)} format={pct} />
            <Slider label="Rotate" value={params.perspectiveRotate} min={-100} max={100} onChange={(v) => setParam('perspectiveRotate', v)} format={pct} />
          </>
        )}

        {section === 'detail' && (
          <>
            <Slider label="Sharpen" value={params.sharpen} min={0} max={100} onChange={(v) => setParam('sharpen', v)} format={pct} />
            <Slider label="Definition" value={params.definition} min={-100} max={100} onChange={(v) => setParam('definition', v)} format={pct} />
          </>
        )}

        {section === 'film' && (
          <>
            <div className="subtabs">
              {(['vignette', 'grain', 'halation', 'bokeh'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`subtab${filmSub === t ? ' active' : ''}`}
                  onClick={() => setFilmSub(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {filmSub === 'vignette' && (
              <>
                <Slider label="Strength" value={params.vignetteStrength} min={0} max={100} onChange={(v) => setParam('vignetteStrength', v)} format={pct} />
                <Slider label="Radius" value={params.vignetteRadius} min={0.1} max={1} step={0.01} onChange={(v) => setParam('vignetteRadius', v)} format={(v) => v.toFixed(2)} />
                <Slider label="Softness" value={params.vignetteSoftness} min={0.05} max={1} step={0.01} onChange={(v) => setParam('vignetteSoftness', v)} format={(v) => v.toFixed(2)} />
              </>
            )}
            {filmSub === 'grain' && (
              <>
                <Slider label="Amount" value={params.grainAmount} min={0} max={100} onChange={(v) => setParam('grainAmount', v)} format={pct} />
                <Slider label="Size" value={params.grainSize} min={1} max={10} step={0.5} onChange={(v) => setParam('grainSize', v)} />
              </>
            )}
            {filmSub === 'halation' && (
              <>
                <p className="hint">Glow follows the plus on the image — drag it to aim the effect.</p>
                <Slider label="Strength" value={params.halationStrength} min={0} max={100} onChange={(v) => setParam('halationStrength', v)} format={pct} />
                <Slider label="Radius" value={params.halationRadius} min={0.05} max={0.8} step={0.01} onChange={(v) => setParam('halationRadius', v)} format={(v) => v.toFixed(2)} />
                <div className="row">
                  <span>Color</span>
                  <input
                    type="color"
                    value={params.halationColor}
                    onChange={(e) => setParam('halationColor', e.target.value)}
                  />
                </div>
                <Slider
                  label="Center X"
                  value={params.halationCenter.x}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => patchParams({ halationCenter: { ...params.halationCenter, x: v } })}
                  format={(v) => v.toFixed(2)}
                />
                <Slider
                  label="Center Y"
                  value={params.halationCenter.y}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => patchParams({ halationCenter: { ...params.halationCenter, y: v } })}
                  format={(v) => v.toFixed(2)}
                />
              </>
            )}
            {filmSub === 'bokeh' && (
              <>
                <Slider label="Strength" value={params.bokehStrength} min={0} max={100} onChange={(v) => setParam('bokehStrength', v)} format={pct} />
                <Slider label="Focus radius" value={params.bokehRadius} min={0.1} max={1} step={0.01} onChange={(v) => setParam('bokehRadius', v)} format={(v) => v.toFixed(2)} />
              </>
            )}
          </>
        )}

        {section === 'masks' && (
          <>
            <Toggle label="Linear mask" value={params.linearMaskEnabled} onChange={(v) => setParam('linearMaskEnabled', v)} />
            <Slider label="Linear start" value={params.linearMaskStartY} min={0} max={1} step={0.01} onChange={(v) => setParam('linearMaskStartY', v)} format={(v) => v.toFixed(2)} />
            <Slider label="Linear end" value={params.linearMaskEndY} min={0} max={1} step={0.01} onChange={(v) => setParam('linearMaskEndY', v)} format={(v) => v.toFixed(2)} />
            <Toggle label="Circular mask" value={params.circularMaskEnabled} onChange={(v) => setParam('circularMaskEnabled', v)} />
            <Slider label="Circle radius" value={params.circularMaskRadius} min={0.05} max={1} step={0.01} onChange={(v) => setParam('circularMaskRadius', v)} format={(v) => v.toFixed(2)} />
            <Slider label="Mask exposure" value={params.maskExposure} min={-100} max={100} onChange={(v) => setParam('maskExposure', v)} format={pct} />
            <Slider label="Mask saturation" value={params.maskSaturation} min={-100} max={100} onChange={(v) => setParam('maskSaturation', v)} format={pct} />
          </>
        )}

        {section === 'double' && (
          <>
            <Toggle
              label="Enable"
              value={params.doubleExposureEnabled}
              onChange={(v) => setParam('doubleExposureEnabled', v)}
            />
            <label className="btn file-btn" style={{ marginBottom: '0.75rem' }}>
              {blendBitmap ? 'Change blend photo' : 'Select blend photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void openBlendImage(f);
                  e.target.value = '';
                }}
              />
            </label>
            {blendBitmap && (
              <button type="button" className="btn" style={{ marginBottom: '0.75rem' }} onClick={clearBlend}>
                Clear blend photo
              </button>
            )}
            <p className="hint">Fujifilm-style blend modes for layering a second still.</p>
            <div className="chip-row">
              {BLEND_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`chip${params.doubleExposureBlend === m.id ? ' active' : ''}`}
                  onClick={() => setParam('doubleExposureBlend', m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Slider label="Opacity" value={params.doubleExposureOpacity} min={0} max={1} step={0.01} onChange={(v) => setParam('doubleExposureOpacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider
              label="Shift X"
              value={params.doubleExposureOffset.x}
              min={-0.5}
              max={0.5}
              step={0.01}
              onChange={(v) => patchParams({ doubleExposureOffset: { ...params.doubleExposureOffset, x: v } })}
              format={(v) => v.toFixed(2)}
            />
            <Slider
              label="Shift Y"
              value={params.doubleExposureOffset.y}
              min={-0.5}
              max={0.5}
              step={0.01}
              onChange={(v) => patchParams({ doubleExposureOffset: { ...params.doubleExposureOffset, y: v } })}
              format={(v) => v.toFixed(2)}
            />
          </>
        )}
      </div>
    </aside>
  );
}
