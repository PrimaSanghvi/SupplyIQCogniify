import type { DC, Lane } from '../../types/network';
import { ArrowRight, Truck } from 'lucide-react';

interface Props {
  lanes: Lane[];
  dcs: DC[];
}

export default function LaneDirectoryPanel({ lanes, dcs }: Props) {
  const dcMap = Object.fromEntries(dcs.map((dc) => [dc.id, dc]));

  // Deduplicate bidirectional lanes
  const seen = new Set<string>();
  const uniqueLanes = lanes.filter((lane) => {
    const key = [lane.origin, lane.destination].sort().join('-');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
          Lane Directory
        </h3>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {uniqueLanes.map((lane) => {
          const fromDC = dcMap[lane.origin];
          const toDC = dcMap[lane.destination];
          return (
            <div key={`${lane.origin}-${lane.destination}`} className="border border-slate-700 rounded-lg p-3">
              <div className="flex items-center gap-2 text-xs mb-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-white">{fromDC?.name}</span>
                <ArrowRight className="w-3 h-3 text-slate-500" />
                <span className="font-semibold text-white">{toDC?.name}</span>
              </div>
              <div className="grid grid-cols-4 text-[10px] font-mono gap-x-3">
                <span>
                  <span className="text-slate-400">Cost:</span>{' '}
                  <span className="text-white">${lane.transport_cost_per_unit}/u</span>
                </span>
                <span>
                  <span className="text-slate-400">CO₂:</span>{' '}
                  <span className="text-white">{lane.carbon_kg_per_unit}kg/u</span>
                </span>
                <span>
                  <span className="text-slate-400">Dist:</span>{' '}
                  <span className="text-white">{lane.distance_miles}mi</span>
                </span>
                <span>
                  <span className="text-slate-400">Transit:</span>{' '}
                  <span className="text-white">{lane.transit_days}d</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
