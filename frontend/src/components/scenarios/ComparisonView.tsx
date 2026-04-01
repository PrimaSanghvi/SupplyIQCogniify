import { ArrowRight, TrendingDown, Leaf, Shield } from 'lucide-react';
import type { ComparisonResult, ScenarioSummary, OptimizationResult } from '../../types/optimization';

interface Props {
  comparison: ComparisonResult;
  scenario: ScenarioSummary;
}

function ResultPanel({ result, label, accent }: { result: OptimizationResult; label: string; accent: string }) {
  return (
    <div className={`flex-1 bg-slate-900 rounded-xl border p-5 ${accent}`}>
      <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-4">{label}</h4>

      {result.transfers.length > 0 ? (
        <div className="space-y-2 mb-4">
          {result.transfers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-slate-800/50 rounded-lg px-3 py-2">
              <span className="text-white font-medium">{t.origin}</span>
              <ArrowRight size={14} className="text-slate-500" />
              <span className="text-white font-medium">{t.destination}</span>
              <span className="text-slate-400 ml-auto">{t.units.toLocaleString()} units</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500 italic mb-4 bg-slate-800/50 rounded-lg px-3 py-2">
          No proactive transfers (accept stockout risk)
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-400 text-xs block">Transport</span>
          <span className="text-white font-medium">${result.cost_breakdown.transport.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-400 text-xs block">Holding</span>
          <span className="text-white font-medium">${result.cost_breakdown.holding.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-400 text-xs block">Stockout Penalty</span>
          <span className="text-white font-medium">${result.cost_breakdown.stockout_penalty.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-400 text-xs block">Total Cost</span>
          <span className="text-white font-bold">${result.objective_value.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function ComparisonView({ comparison, scenario }: Props) {
  const { savings } = comparison;

  return (
    <div className="space-y-4">
      {/* Savings banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
        <h3 className="text-emerald-400 font-semibold text-lg mb-2">
          Optimization saves ${savings.cost.toLocaleString()} on "{scenario.name}"
        </h3>
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-1.5 text-emerald-300">
            <TrendingDown size={14} />
            <span>${savings.transport.toLocaleString()} transport savings</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-300">
            <Shield size={14} />
            <span>${savings.stockout_penalty.toLocaleString()} stockout avoided</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-300">
            <Leaf size={14} />
            <span>{savings.carbon_kg.toLocaleString()} kg CO2 difference</span>
          </div>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="flex gap-4">
        <ResultPanel
          result={comparison.intuitive}
          label="Intuitive Approach"
          accent="border-red-500/30"
        />
        <ResultPanel
          result={comparison.optimized}
          label="AI-Optimized"
          accent="border-emerald-500/30"
        />
      </div>
    </div>
  );
}
