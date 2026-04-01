import type { DC } from '../../types/network';
import { MapPin, AlertTriangle } from 'lucide-react';
import { deriveRisk } from './NetworkMap';

interface Props {
  dcs: DC[];
}

function riskColorHex(level: string) {
  if (level === 'high') return '#ef4444';
  if (level === 'medium') return '#f59e0b';
  return '#10b981';
}

export default function DCDetailsPanel({ dcs }: Props) {
  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
          Distribution Centers
        </h3>
      </div>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {dcs.map((dc) => {
          const util = (dc.current_stock / dc.capacity) * 100;
          const coverage =
            dc.demand_forecast > 0
              ? (dc.current_stock / dc.demand_forecast) * 7
              : 999;
          const risk = deriveRisk(dc);
          const isAtRisk = risk === 'high' || risk === 'medium';

          return (
            <div key={dc.id} className="border border-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-sm font-semibold text-white">{dc.name}</span>
                </div>
                {isAtRisk && (
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{
                      background: risk === 'high' ? '#ef444420' : '#f59e0b20',
                      color: riskColorHex(risk),
                    }}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {risk === 'high' ? 'AT RISK' : 'WATCH'}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] font-mono">
                <div>
                  <span className="text-slate-400">Inventory: </span>
                  <span className="text-white">{dc.current_stock.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Capacity: </span>
                  <span className="text-white">{dc.capacity.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Util: </span>
                  <span className={util > 85 ? 'text-red-400' : 'text-green-400'}>
                    {util.toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Demand: </span>
                  <span className="text-white">{dc.demand_forecast.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Safety: </span>
                  <span className="text-white">{dc.safety_stock.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Cover: </span>
                  <span className={coverage < 7 ? 'text-red-400' : 'text-green-400'}>
                    {coverage.toFixed(1)}d
                  </span>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1">
                {dc.lat.toFixed(3)}, {dc.lng.toFixed(3)} · Holding: ${dc.holding_cost_per_unit}/unit
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
