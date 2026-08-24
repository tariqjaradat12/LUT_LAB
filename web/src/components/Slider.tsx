type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

export function Slider({ label, value, min, max, step = 1, onChange, format }: Props) {
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <span>{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="row">
      <span>{label}</span>
      <button
        type="button"
        className={`toggle${value ? ' on' : ''}`}
        aria-pressed={value}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  );
}
