import type { DC } from '../../types/network';
import { Package, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  dc: DC;
}

export default function DCCard({ dc }: Props) {
  const utilization = (dc.current_stock / dc.capacity) * 100;
  const surplus = dc.current_stock - dc.demand_forecast;
  const isSurplus = surplus > 0;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-white font-semibold">{dc.name}</h4>
          <span className="text-xs text-slate-400">{dc.id}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
          isSurplus ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {isSurplus ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {surplus > 0 ? '+' : ''}{surplus.toLocaleString()}
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Utilization</span>
          <span>{utilization.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(utilization, 100)}%`,
              background: utilization > 90 ? '#ef4444' : utilization > 70 ? '#f59e0b' : '#22c55e',
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-slate-400 text-xs block">Stock</span>
          <span className="text-white font-medium flex items-center gap-1">
            <Package size={13} className="text-slate-500" />
            {dc.current_stock.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-xs block">Demand</span>
          <span className="text-white font-medium">{dc.demand_forecast.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-400 text-xs block">Capacity</span>
          <span className="text-white font-medium">{dc.capacity.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-slate-400 text-xs block">Holding $/unit</span>
          <span className="text-white font-medium">${dc.holding_cost_per_unit.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
