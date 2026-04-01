import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { fetchPareto } from '../../api/optimize';
import type { ParetoStrategyResult } from '../../types/optimization';

interface Props {
  scenarioId: string;
}

export default function ParetoTable({ scenarioId }: Props) {
  const [data, setData] = useState<ParetoStrategyResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPareto(scenarioId || undefined)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [scenarioId]);

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
          <div className="animate-spin w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full" />
          Computing Pareto strategies...
        </div>
      </div>
    );
  }

  if (data.length === 0) return null;

  const minObjective = Math.min(...data.map((s) => s.result.objective_value));

  const fmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtKg = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center gap-2 mb-4">
        <h4 className="text-white font-semibold uppercase tracking-wide text-sm">
          Pareto Frontier — Strategy Comparison
        </h4>
        <div className="group relative">
          <Info size={14} className="text-slate-500 cursor-help" />
          <div className="absolute bottom-6 left-0 hidden group-hover:block bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 w-64 z-10">
            Each row solves the LP with different weight presets to show trade-offs between cost, carbon, and service risk.
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left text-slate-400 text-xs uppercase tracking-wide py-2 pr-4 font-medium">Strategy</th>
              <th className="text-left text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Weights (C/G/R)</th>
              <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Objective Z</th>
              <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Transport $</th>
              <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Holding $</th>
              <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Stockout $</th>
              <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">CO₂ (kg)</th>
              <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Moves</th>
              <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 pl-3 font-medium">Anomalies</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => {
              const r = s.result;
              const isMin = r.objective_value === minObjective;
              const weightsLabel = `${Math.round(s.weights.cost * 100)}/${Math.round(s.weights.carbon * 100)}/${Math.round(s.weights.service_risk * 100)}`;
              const moves = r.transfers.length;
              const anomalies = r.dc_states_after.filter((dc) => dc.utilization_pct > 100).length;

              return (
                <tr
                  key={s.strategy_name}
                  className={`border-b border-slate-800 ${isMin ? 'border-l-2 border-l-cyan-500' : ''}`}
                >
                  <td className="py-3 pr-4">
                    <div className="text-cyan-400 font-medium">{s.strategy_name}</div>
                    <div className="text-slate-500 text-xs mt-0.5 max-w-[260px]">{s.strategy_description}</div>
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-mono text-xs">{weightsLabel}</td>
                  <td className="py-3 px-3 text-right text-white font-medium font-mono">{fmt(r.objective_value)}</td>
                  <td className="py-3 px-3 text-right text-slate-300 font-mono">{fmt(r.cost_breakdown.transport)}</td>
                  <td className="py-3 px-3 text-right text-slate-300 font-mono">{fmt(r.cost_breakdown.holding)}</td>
                  <td className="py-3 px-3 text-right text-slate-300 font-mono">{fmt(r.cost_breakdown.stockout_penalty)}</td>
                  <td className="py-3 px-3 text-right text-slate-300 font-mono">{fmtKg(r.total_carbon_kg)}</td>
                  <td className="py-3 px-3 text-right text-white font-mono">{moves}</td>
                  <td className="py-3 pl-3 text-right">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                      anomalies > 0
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {anomalies}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
