import { ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { OptimizationResult } from '../../types/optimization';

interface Props {
  result: OptimizationResult;
}

const COLORS = ['#06b6d4', '#22c55e', '#ef4444', '#f59e0b'];

export default function ResultsPanel({ result }: Props) {
  const costData = [
    { name: 'Transport', value: result.cost_breakdown.transport },
    { name: 'Holding', value: result.cost_breakdown.holding },
    { name: 'Stockout', value: result.cost_breakdown.stockout_penalty },
    { name: 'Overflow', value: result.cost_breakdown.overflow_penalty },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
        result.status === 'Optimal'
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-yellow-500/10 text-yellow-400'
      }`}>
        {result.status === 'Optimal' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        {result.status} — Total Cost: ${result.objective_value.toLocaleString()}
        <span className="text-slate-400 ml-2">| Carbon: {result.total_carbon_kg.toLocaleString()} kg CO2</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Transfers */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <h4 className="text-white font-semibold mb-3">Recommended Transfers</h4>
          {result.transfers.length > 0 ? (
            <div className="space-y-2">
              {result.transfers.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-slate-800/50 rounded-lg px-3 py-2.5">
                  <span className="text-cyan-400 font-medium min-w-[60px]">{t.origin}</span>
                  <ArrowRight size={14} className="text-slate-500" />
                  <span className="text-cyan-400 font-medium min-w-[60px]">{t.destination}</span>
                  <span className="text-white ml-auto font-medium">{t.units.toLocaleString()} units</span>
                  <span className="text-slate-400 text-xs">${t.cost.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm italic">No transfers recommended</p>
          )}
        </div>

        {/* Cost breakdown */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <h4 className="text-white font-semibold mb-3">Cost Breakdown</h4>
          <div className="flex items-center gap-4">
            <div style={{ width: 140, height: 140 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={costData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} strokeWidth={0}>
                    {costData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                    formatter={(v: number) => `$${v.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              {costData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-slate-400">{d.name}</span>
                  <span className="text-white font-medium ml-auto">${d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DC States */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <h4 className="text-white font-semibold mb-3">Post-Optimization DC States</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {result.dc_states_after.map((dc) => {
            const changed = dc.stock_before !== dc.stock_after;
            return (
              <div key={dc.id} className={`rounded-lg p-3 text-center ${changed ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-slate-800/50'}`}>
                <div className="text-xs text-slate-400">{dc.name}</div>
                <div className="text-white font-semibold mt-1">
                  {dc.stock_after.toLocaleString()}
                </div>
                {changed && (
                  <div className="text-xs text-cyan-400 mt-0.5">
                    {dc.stock_after > dc.stock_before ? '+' : ''}{(dc.stock_after - dc.stock_before).toLocaleString()}
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-1">{dc.utilization_pct}% util</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
