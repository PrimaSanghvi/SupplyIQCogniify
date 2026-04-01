import { useState, useEffect, useMemo } from 'react';
import { DollarSign, Leaf, Package, AlertTriangle, TrendingUp, Wind, Zap, Info } from 'lucide-react';
import { fetchMovements } from '../api/optimize';
import { fetchScenarios } from '../api/network';
import type { Movement, MovementsSummary, ScenarioSummary } from '../types/optimization';

type ModeFilter = '' | 'truck' | 'rail' | 'intermodal';
type FlagFilter = '' | 'Anomaly' | 'Standard';
type SortKey = 'cost_desc' | 'cost_asc' | 'units_desc' | 'carbon_desc' | 'cpu_desc';

export default function MovementLedgerPage() {
  const [scenarioId, setScenarioId] = useState('');
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [summary, setSummary] = useState<MovementsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [modeFilter, setModeFilter] = useState<ModeFilter>('');
  const [flagFilter, setFlagFilter] = useState<FlagFilter>('');
  const [dcFilter, setDcFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('cost_desc');

  useEffect(() => {
    fetchScenarios().then(setScenarios);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchMovements(scenarioId || undefined)
      .then((res) => {
        setMovements(res.movements);
        setSummary(res.summary);
      })
      .catch(() => {
        setMovements([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [scenarioId]);

  // Get unique DCs from movements
  const dcOptions = useMemo(() => {
    const dcs = new Set<string>();
    movements.forEach((m) => {
      dcs.add(m.origin);
      dcs.add(m.destination);
    });
    return Array.from(dcs).sort();
  }, [movements]);

  // Filter and sort
  const filteredMovements = useMemo(() => {
    let result = [...movements];

    if (modeFilter) {
      result = result.filter((m) => m.mode === modeFilter);
    }
    if (flagFilter) {
      result = result.filter((m) => m.flag === flagFilter);
    }
    if (dcFilter) {
      result = result.filter((m) => m.origin === dcFilter || m.destination === dcFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'cost_desc': return b.cost - a.cost;
        case 'cost_asc': return a.cost - b.cost;
        case 'units_desc': return b.units - a.units;
        case 'carbon_desc': return b.carbon_kg - a.carbon_kg;
        case 'cpu_desc': return b.cost_per_unit - a.cost_per_unit;
        default: return 0;
      }
    });

    return result;
  }, [movements, modeFilter, flagFilter, dcFilter, sortBy]);

  const fmt = (v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtNum = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });

  const selectClass = 'bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500';

  const modeBadge = (mode: string) => {
    const styles: Record<string, string> = {
      truck: 'bg-cyan-500/20 text-cyan-400',
      rail: 'bg-slate-600/40 text-slate-300',
      intermodal: 'bg-teal-500/20 text-teal-400',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[mode] || styles.truck}`}>
        {mode}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">Movement Ledger</h2>
            <div className="group relative">
              <Info size={16} className="text-slate-500 cursor-help" />
              <div className="absolute bottom-6 left-0 hidden group-hover:block bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 w-72 z-10">
                All proposed inventory redeployment movements from the optimizer with anomaly detection.
              </div>
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            All proposed inventory redeployment movements with advanced filtering and analytics
          </p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">LIVE</span>
      </div>

      {/* KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <DollarSign size={12} /> TOTAL COST
            </div>
            <div className="text-xl font-bold text-cyan-400">{fmt(summary.total_cost)}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Leaf size={12} /> TOTAL CO₂
            </div>
            <div className="text-xl font-bold text-cyan-400">{summary.total_carbon_tonnes}t</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Package size={12} /> UNITS MOVED
            </div>
            <div className="text-xl font-bold text-cyan-400">{fmtNum(summary.total_units)}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <AlertTriangle size={12} /> ANOMALIES
            </div>
            <div className={`text-xl font-bold ${summary.anomaly_count > 0 ? 'text-orange-400' : 'text-emerald-400'}`}>
              {summary.anomaly_count}
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <TrendingUp size={12} /> AVG $/UNIT
            </div>
            <div className="text-xl font-bold text-white">${summary.avg_cost_per_unit}</div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Wind size={12} /> AVG CO₂/UNIT
            </div>
            <div className="text-xl font-bold text-white">{summary.avg_carbon_per_unit_kg} kg</div>
          </div>
        </div>
      )}

      {/* Filters & Sort */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">
          <Info size={12} /> Filters & Sort
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1">SCENARIO</label>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={selectClass + ' w-full'}>
              <option value="">Base Network</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">TRANSPORT MODE</label>
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value as ModeFilter)} className={selectClass + ' w-full'}>
              <option value="">All Modes</option>
              <option value="truck">Truck</option>
              <option value="rail">Rail</option>
              <option value="intermodal">Intermodal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">ANOMALY STATUS</label>
            <select value={flagFilter} onChange={(e) => setFlagFilter(e.target.value as FlagFilter)} className={selectClass + ' w-full'}>
              <option value="">All</option>
              <option value="Anomaly">Anomaly</option>
              <option value="Standard">Standard</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">DISTRIBUTION CENTER</label>
            <select value={dcFilter} onChange={(e) => setDcFilter(e.target.value)} className={selectClass + ' w-full'}>
              <option value="">All DCs</option>
              {dcOptions.map((dc) => (
                <option key={dc} value={dc}>{dc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">SORT BY</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className={selectClass + ' w-full'}>
              <option value="cost_desc">Cost (High → Low)</option>
              <option value="cost_asc">Cost (Low → High)</option>
              <option value="units_desc">Units (High → Low)</option>
              <option value="carbon_desc">CO₂ (High → Low)</option>
              <option value="cpu_desc">$/Unit (High → Low)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Proposed Movements Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-semibold uppercase tracking-wide text-sm">Proposed Movements</h4>
          <span className="text-xs text-slate-500">{filteredMovements.length} of {movements.length} shown</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-slate-400">
            <div className="animate-spin w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full" />
            Loading movements...
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No movements proposed for this scenario.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-slate-400 text-xs uppercase tracking-wide py-2 pr-3 font-medium w-10">#</th>
                  <th className="text-left text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">From</th>
                  <th className="text-left text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">To</th>
                  <th className="text-left text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Mode</th>
                  <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Units</th>
                  <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">Cost</th>
                  <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">$/Unit</th>
                  <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">CO₂ (kg)</th>
                  <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 px-3 font-medium">CO₂/Unit</th>
                  <th className="text-right text-slate-400 text-xs uppercase tracking-wide py-2 pl-3 font-medium">Flag</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => (
                  <tr key={m.index} className="border-b border-slate-800">
                    <td className="py-3 pr-3 text-slate-500 font-mono">{m.index}</td>
                    <td className="py-3 px-3 text-white font-medium">{m.origin.replace('DC-', '')}</td>
                    <td className="py-3 px-3 text-white font-medium">{m.destination.replace('DC-', '')}</td>
                    <td className="py-3 px-3">{modeBadge(m.mode)}</td>
                    <td className="py-3 px-3 text-right text-white font-mono">{fmtNum(m.units)}</td>
                    <td className="py-3 px-3 text-right text-white font-mono">{fmt(m.cost)}</td>
                    <td className="py-3 px-3 text-right text-slate-300 font-mono">${m.cost_per_unit.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-slate-300 font-mono">{fmtNum(m.carbon_kg)}</td>
                    <td className="py-3 px-3 text-right text-slate-300 font-mono">{m.carbon_per_unit.toFixed(1)}</td>
                    <td className="py-3 pl-3 text-right">
                      {m.flag === 'Anomaly' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          <Zap size={10} /> Anomaly
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-400">
                          Standard
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
