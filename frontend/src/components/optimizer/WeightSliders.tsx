import { DollarSign, Leaf, Shield } from 'lucide-react';
import type { Weights } from '../../types/optimization';

interface Props {
  weights: Weights;
  onChange: (w: Weights) => void;
}

const SLIDERS = [
  { key: 'cost' as const, label: 'Cost Priority', sublabel: '"Cash King"', Icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-400' },
  { key: 'carbon' as const, label: 'Carbon Priority', sublabel: '"Green Choice"', Icon: Leaf, color: 'text-green-400', bg: 'bg-green-400' },
  { key: 'service_risk' as const, label: 'Service Priority', sublabel: '"Service First"', Icon: Shield, color: 'text-blue-400', bg: 'bg-blue-400' },
];

export default function WeightSliders({ weights, onChange }: Props) {
  const handleSliderChange = (key: keyof Weights, newVal: number) => {
    const other1 = SLIDERS.filter((s) => s.key !== key);
    const remaining = 1 - newVal;
    const otherSum = other1.reduce((sum, s) => sum + weights[s.key], 0);

    const updated = { ...weights, [key]: newVal };
    if (otherSum > 0) {
      for (const s of other1) {
        updated[s.key] = Math.max(0, (weights[s.key] / otherSum) * remaining);
      }
    } else {
      for (const s of other1) {
        updated[s.key] = remaining / other1.length;
      }
    }

    // Round to avoid floating point issues
    const total = Object.values(updated).reduce((a, b) => a + b, 0);
    const keys = Object.keys(updated) as (keyof Weights)[];
    updated[keys[keys.length - 1]] += 1 - total;

    onChange(updated);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 space-y-5">
      <h3 className="text-white font-semibold">Strategy Weights</h3>

      {SLIDERS.map(({ key, label, sublabel, Icon, color, bg }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Icon size={14} className={color} />
              <span className="text-sm text-white">{label}</span>
              <span className="text-xs text-slate-500">{sublabel}</span>
            </div>
            <span className={`text-sm font-mono font-medium ${color}`}>
              {(weights[key] * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(weights[key] * 100)}
            onChange={(e) => handleSliderChange(key, Number(e.target.value) / 100)}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--tw-${bg}) ${weights[key] * 100}%, #1e293b ${weights[key] * 100}%)`,
            }}
          />
        </div>
      ))}

      <div className="text-xs text-slate-500 text-center pt-1 border-t border-slate-800">
        Weights auto-normalize to 100%
      </div>
    </div>
  );
}
