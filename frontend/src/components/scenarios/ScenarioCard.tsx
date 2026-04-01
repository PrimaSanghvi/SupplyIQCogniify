import { Clock, Truck, Package } from 'lucide-react';
import type { ScenarioSummary } from '../../types/optimization';

const ICONS: Record<string, typeof Clock> = {
  clock: Clock,
  truck: Truck,
  package: Package,
};

interface Props {
  scenario: ScenarioSummary;
  isSelected: boolean;
  onSelect: () => void;
}

export default function ScenarioCard({ scenario, isSelected, onSelect }: Props) {
  const Icon = ICONS[scenario.icon] || Package;

  return (
    <button
      onClick={onSelect}
      className={`text-left p-5 rounded-xl border transition-all ${
        isSelected
          ? 'bg-cyan-500/10 border-cyan-500 shadow-lg shadow-cyan-500/10'
          : 'bg-slate-900 border-slate-700 hover:border-slate-500'
      }`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
        isSelected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'
      }`}>
        <Icon size={20} />
      </div>
      <h3 className="text-white font-semibold mb-1">{scenario.name}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{scenario.description}</p>
    </button>
  );
}
