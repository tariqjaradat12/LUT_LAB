import { useState } from 'react';
import { BLEND_MODES, HUE_BANDS, type FilmSubTab, type HueBand, type ToolSection } from '../engine/types';
import { useEditStore } from '../state/editStore';
import { CurveEditor } from './CurveEditor';
import { LutLooksPanel } from './LutLooksPanel';
import { Slider, Toggle } from './Slider';

const SECTIONS: { id: ToolSection; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'color', label: 'Color' },
  { id: 'curves', label: 'Curves' },
  { id: 'hsl', label: 'HSL' },
  { id: 'detail', label: 'Detail' },
  { id: 'film', label: 'Lens & Film' },
  { id: 'masks', label: 'Masks' },
  { id: 'double', label: 'Double exposure' },
  { id: 'luts', label: 'LUTs' },
];

const pct = (v: number) => `${Math.round(v)}`;
const ev = (v: number) => `${v.toFixed(2)} EV`;
const fStop = (v: number) => `f/${v.toFixed(1)}`;

const FILM_TABS: { id: FilmSubTab; label: string }[] = [
  { id: 'vignette', label: 'Vignette' },
  { id: 'grain', label: 'Grain' },
  { id: 'halation', label: 'Halation' },
  { id: 'bokeh', label: 'Bokeh' },
  { id: 'anamorphic', label: 'Anamorphic streaks' },
];

export function ToolPanel() {
  const {
    params, setParam, patchParams, section, setSection, filmSub, setFilmSub,
    openBlendImage, clearBlend, blendBitmap,
  } = useEditStore();
  const [hslBand, setHslBand] = useState<HueBand>('red');

  return (
    <aside className={`panel${section === 'luts' ? ' panel--luts' : ''}`}>
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
        {section === 'luts' && <LutLooksPanel />}

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
          <CurveEditor
            curves={params.curves}
            onChange={(ch, points) => setParam('curves', { ...params.curves, [ch]: points })}
          />
        )}

        {section === 'hsl' && (
          <>
            <div className="chip-row">
              {HUE_BANDS.map((band) => (
                <button
                  key={band}
                  type="button"
                  className={`chip${hslBand === band ? ' active' : ''}`}
                  onClick={() => setHslBand(band)}
                >
                  {band[0].toUpperCase() + band.slice(1)}
                </button>
              ))}
            </div>
            <Slider
              label="Hue"
              value={params.hsl[hslBand].hue}
              min={-100}
              max={100}
              onChange={(v) => setParam('hsl', { ...params.hsl, [hslBand]: { ...params.hsl[hslBand], hue: v } })}
              format={pct}
            />
            <Slider
              label="Saturation"
              value={params.hsl[hslBand].saturation}
              min={-100}
              max={100}
              onChange={(v) => setParam('hsl', { ...params.hsl, [hslBand]: { ...params.hsl[hslBand], saturation: v } })}
              format={pct}
            />
            <Slider
              label="Luminance"
              value={params.hsl[hslBand].luminance}
              min={-100}
              max={100}
              onChange={(v) => setParam('hsl', { ...params.hsl, [hslBand]: { ...params.hsl[hslBand], luminance: v } })}
              format={pct}
            />
          </>
        )}

        {section === 'detail' && (
          <>
            <Slider label="Sharpen" value={params.sharpen} min={0} max={100} onChange={(v) => setParam('sharpen', v)} format={pct} />
            <Slider label="Definition" value={params.definition} min={-100} max={100} onChange={(v) => setParam('definition', v)} format={pct} />
            <Slider label="Softness" value={params.softness} min={0} max={100} onChange={(v) => setParam('softness', v)} format={pct} />
            <Slider label="Noise reduction" value={params.denoiseLuminance} min={0} max={100} onChange={(v) => setParam('denoiseLuminance', v)} format={pct} />
            <Slider label="Color noise reduction" value={params.denoiseColor} min={0} max={100} onChange={(v) => setParam('denoiseColor', v)} format={pct} />
          </>
        )}

        {section === 'film' && (
          <>
            <div className="subtabs">
              {FILM_TABS.map((t) => (
                <button key={t.id} type="button" className={`subtab${filmSub === t.id ? ' active' : ''}`} onClick={() => setFilmSub(t.id)}>
                  {t.label}
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
                <Slider label="Size" value={params.grainSize} min={0.5} max={8} step={0.1} onChange={(v) => setParam('grainSize', v)} format={(v) => v.toFixed(1)} />
                <Slider label="Roughness" value={params.grainRoughness} min={0} max={1} step={0.01} onChange={(v) => setParam('grainRoughness', v)} format={(v) => v.toFixed(2)} />
              </>
            )}
            {filmSub === 'halation' && (
              <>
                <p className="hint">Drag the plus on the image to aim the glow.</p>
                <Slider label="Strength" value={params.halationStrength} min={0} max={100} onChange={(v) => setParam('halationStrength', v)} format={pct} />
                <Slider label="Radius" value={params.halationRadius} min={0.05} max={0.8} step={0.01} onChange={(v) => setParam('halationRadius', v)} format={(v) => v.toFixed(2)} />
                <div className="row">
                  <span>Color</span>
                  <input type="color" value={params.halationColor} onChange={(e) => setParam('halationColor', e.target.value)} />
                </div>
              </>
            )}
            {filmSub === 'bokeh' && (
              <>
                <p className="hint">Drag the plus to set what stays sharp. Lower f-numbers blur more.</p>
                <Slider label="Strength" value={params.bokehStrength} min={0} max={100} onChange={(v) => setParam('bokehStrength', v)} format={pct} />
                <Slider label="Aperture" value={params.bokehAperture} min={1.4} max={22} step={0.1} onChange={(v) => setParam('bokehAperture', v)} format={fStop} />
              </>
            )}
            {filmSub === 'anamorphic' && (
              <>
                <p className="hint">Drag the plus to center the streaks.</p>
                <Slider label="Amount" value={params.longExposureAmount} min={0} max={100} onChange={(v) => setParam('longExposureAmount', v)} format={pct} />
                <Slider label="Direction" value={params.longExposureDirection} min={-180} max={180} onChange={(v) => setParam('longExposureDirection', v)} />
              </>
            )}
          </>
        )}

        {section === 'masks' && (
          <>
            <p className="hint">Turn on a mask, then drag the plus icons on the image.</p>
            <Toggle label="Linear mask" value={params.linearMaskEnabled} onChange={(v) => setParam('linearMaskEnabled', v)} />
            <Slider label="Linear feather" value={params.linearMaskFeather} min={0.02} max={0.5} step={0.01} onChange={(v) => setParam('linearMaskFeather', v)} format={(v) => v.toFixed(2)} />
            <Toggle label="Circular mask" value={params.circularMaskEnabled} onChange={(v) => setParam('circularMaskEnabled', v)} />
            <Slider label="Circle radius" value={params.circularMaskRadius} min={0.05} max={1} step={0.01} onChange={(v) => setParam('circularMaskRadius', v)} format={(v) => v.toFixed(2)} />
            <Slider label="Mask exposure" value={params.maskExposure} min={-100} max={100} onChange={(v) => setParam('maskExposure', v)} format={pct} />
            <Slider label="Mask saturation" value={params.maskSaturation} min={-100} max={100} onChange={(v) => setParam('maskSaturation', v)} format={pct} />
          </>
        )}

        {section === 'double' && (
          <>
            <Toggle label="Enable" value={params.doubleExposureEnabled} onChange={(v) => setParam('doubleExposureEnabled', v)} />
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
