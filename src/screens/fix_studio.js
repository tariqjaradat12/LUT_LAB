const fs = require('fs');
const path = require('path');

const studioPath = path.join(__dirname, 'EditStudio.tsx');
let content = fs.readFileSync(studioPath, 'utf8');

// Strip out any previously added static formatters and handlers first, so we start clean
content = content.replace(/\/\/ ─── Stable Static Formatters[\s\S]*?\n\n/g, '');
content = content.replace(/\/\/ Stable helper callbacks[\s\S]*?\n\n/g, '');

// Clean any previous sliderKey properties
content = content.replace(/\bsliderKey="[^"]*"\s+/g, '');
content = content.replace(/\bsliderKey=\{[^}]*\}\s+/g, '');

// Clean any onValueChange properties so we can rewrite them cleanly
content = content.replace(/onValueChange={[\s\S]*?}/g, 'onValueChange={__PLACEHOLDER__}');

// Re-add formatters and handlers cleanly
const formatters = `
// ─── Stable Static Formatters for ToolSliders ─────────────────────────────────
const formatEV = (v: number) => \`\${v >= 0 ? '+' : ''}\${v.toFixed(2)} EV\`;
const formatPercent = (v: number) => \`\${Math.round(v * 100)}%\`;
const formatDegree = (v: number) => \`\${v >= 0 ? '+' : ''}\${v}°\`;
const formatTemp = (v: number) => v < 0 ? \`\${v}K\` : v > 0 ? \`+\${v}K\` : '0';
`;

content = content.replace(
  'const { MediaPicker } = NativeModules;',
  `const { MediaPicker } = NativeModules;\n${formatters}`
);

const handlers = `
  // Stable helper callbacks for slider updates
  const updateCrop = useCallback((key: any, val: number) => {
    setParams(prev => {
      setHistoryStack(h => [...h.slice(-19), prev]);
      return { ...prev, crop: { ...prev.crop, [key]: val } };
    });
  }, []);

  const updateDoubleExposureOffset = useCallback((key: any, val: number) => {
    setParams(prev => {
      setHistoryStack(h => [...h.slice(-19), prev]);
      return { ...prev, doubleExposureOffset: { ...prev.doubleExposureOffset, [key]: val } };
    });
  }, []);

  const updateBwMix = useCallback((band: any, val: number) => {
    setParams(prev => {
      setHistoryStack(h => [...h.slice(-19), prev]);
      return { ...prev, bwMix: { ...prev.bwMix, [band]: val } };
    });
  }, []);

  const updateActiveCp = useCallback((field: any, val: number) => {
    if (!activeControlPointId) return;
    setParams(prev => {
      const updated = prev.controlPoints.map(c => 
        c.id === activeControlPointId ? { ...c, [field]: val } : c
      );
      setHistoryStack(h => [...h.slice(-19), prev]);
      return { ...prev, controlPoints: updated };
    });
  }, [activeControlPointId]);
`;

content = content.replace(
  'const [sharePrice, setSharePrice] = useState(\'0\');',
  `const [sharePrice, setSharePrice] = useState('0');\n${handlers}`
);

// Now process all ToolSliders
content = content.replace(/<ToolSlider([\s\S]*?)\/>/g, (match, inner) => {
  let updatedInner = inner;

  // Infer the sliderKey and handler from value prop
  let sliderKey = '';
  let handler = 'update as any';

  if (updatedInner.includes('value={params.crop.')) {
    const m = updatedInner.match(/value={params\.crop\.([^}]+)}/);
    sliderKey = m ? m[1].trim() : '';
    handler = 'updateCrop as any';
  } else if (updatedInner.includes('value={params.doubleExposureOffset.')) {
    const m = updatedInner.match(/value={params\.doubleExposureOffset\.([^}]+)}/);
    sliderKey = m ? m[1].trim() : '';
    handler = 'updateDoubleExposureOffset as any';
  } else if (updatedInner.includes('value={params.bwMix[band]}')) {
    sliderKey = '{band}';
    handler = 'updateBwMix as any';
  } else if (updatedInner.includes('value={activeCp.')) {
    const m = updatedInner.match(/value={activeCp\.([^}]+)}/);
    sliderKey = m ? m[1].trim() : '';
    handler = 'updateActiveCp as any';
  } else if (updatedInner.includes('value={params.')) {
    const m = updatedInner.match(/value={params\.([^}]+)}/);
    sliderKey = m ? m[1].trim() : '';
    handler = 'update as any';
  } else if (updatedInner.includes('value={params.doubleExposureOpacity}')) {
    sliderKey = 'doubleExposureOpacity';
    handler = 'update as any';
  } else if (updatedInner.includes('value={activeLutPresetId === lut.id ? params.lutIntensity : 100}')) {
    sliderKey = 'lutIntensity';
    handler = 'update as any';
  } else if (updatedInner.includes('value={params.lutIntensity}')) {
    sliderKey = 'lutIntensity';
    handler = 'update as any';
  }

  // Set the computed sliderKey and onValueChange handler
  if (sliderKey) {
    const keyProp = sliderKey.startsWith('{') ? `sliderKey=${sliderKey}` : `sliderKey="${sliderKey}"`;
    updatedInner = ` ${keyProp}` + updatedInner.replace('onValueChange={__PLACEHOLDER__}', `onValueChange={${handler}}`);
  } else {
    // Fallback if we cannot infer the key
    updatedInner = updatedInner.replace('onValueChange={__PLACEHOLDER__}', 'onValueChange={update as any}');
  }

  // Replace formatValue inline functions
  updatedInner = updatedInner.replace(/formatValue={v\s*=>\s*`\${v\s*>=?\s*0\s*\?\s*'\+'\s*:\s*''}\${v\.toFixed\(2\)}\s*EV`}/g, 'formatValue={formatEV}');
  updatedInner = updatedInner.replace(/formatValue={v\s*=>\s*`\${Math\.round\(v\s*\*\s*100\)}%`}/g, 'formatValue={formatPercent}');
  updatedInner = updatedInner.replace(/formatValue={v\s*=>\s*`\${v\s*>=?\s*0\s*\?\s*'\+'\s*:\s*''}\${v}°`}/g, 'formatValue={formatDegree}');
  updatedInner = updatedInner.replace(/formatValue={v\s*=>\s*v\s*<\s*0\s*\?\s*`\${v}K`\s*:\s*v\s*>\s*0\s*\?\s*`\+\${v}K`\s*:\s*'0'}/g, 'formatValue={formatTemp}');
  updatedInner = updatedInner.replace(/formatValue={v\s*=>\s*`\${Math\.round\(v\s*\*\s*100\)}%\s*Luma`}/g, 'formatValue={v => `${Math.round(v * 100)}% Luma`}');

  return `<ToolSlider${updatedInner}/>`;
});

// Save updated content
fs.writeFileSync(studioPath, content, 'utf8');
console.log('Successfully completed full automatic slider update on EditStudio.tsx!');
