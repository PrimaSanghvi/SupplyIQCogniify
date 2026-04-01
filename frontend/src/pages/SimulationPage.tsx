import { useState, useEffect, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, Calendar, ArrowRight, TrendingDown,
  TrendingUp, Package, Truck, CheckCircle2, ShieldCheck, RefreshCw, ArrowDownToLine, Info
} from 'lucide-react';
import { fetchNetwork } from '../api/network';
import type { DC, Lane } from '../types/network';
import SimulationMap from '../components/simulation/SimulationMap';

// ─── Types ───

interface DaySnapshot {
  day: number;
  dcStates: DCDayState[];
  rebalances: Rebalance[];
  resupplies: Resupply[];
  totalConsumed: number;
  totalResupplied: number;
  totalTransferred: number;
  networkHealth: 'excellent' | 'good' | 'fair';
}

interface DCDayState {
  id: string;
  name: string;
  inventory: number;
  capacity: number;
  dailyDemand: number;
  consumed: number;
  received: number;
  sent: number;
  resupplied: number;
  status: 'normal' | 'low' | 'healthy' | 'surplus';
  daysOfCoverage: number;
  lat: number;
  lng: number;
}

export interface Rebalance {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  units: number;
  reason: string;
  day: number;
  mode: string;
}

interface Resupply {
  dcId: string;
  name: string;
  units: number;
  day: number;
}

// ─── Simulation Engine ───

function getDailyDemand(dc: DC, day: number): number {
  const baseDailyDemand = dc.demand_forecast / 7;
  const dayOfWeek = day % 7;
  const weekdayMult = dayOfWeek < 5 ? 1.08 : 0.80;
  const seed = Math.sin(dc.id.charCodeAt(3) * 100 + day * 31) * 0.5 + 0.5;
  const variance = 0.90 + seed * 0.20;
  const trendMult = 1 + (day / 7) * 0.005;
  // Demand spike for high-demand DCs mid-simulation
  let spikeMult = 1.0;
  if (dc.demand_forecast > 5000 && day >= 8 && day <= 14) spikeMult = 1.25;
  return Math.round(baseDailyDemand * weekdayMult * variance * trendMult * spikeMult);
}

function getResupplyAmount(dc: DC, currentInventory: number): number {
  const targetLevel = dc.capacity * 0.75;
  return Math.max(0, Math.round(targetLevel - currentInventory));
}

function findLane(fromId: string, toId: string, lanes: Lane[]): Lane | undefined {
  return lanes.find(
    (l) => (l.origin === fromId && l.destination === toId) || (l.origin === toId && l.destination === fromId)
  );
}

function runSimulation(dcs: DC[], lanes: Lane[], totalDays: number, resupplyInterval: number): DaySnapshot[] {
  const snapshots: DaySnapshot[] = [];
  const inventories: Record<string, number> = {};
  dcs.forEach((dc) => { inventories[dc.id] = dc.current_stock; });

  for (let day = 1; day <= totalDays; day++) {
    const rebalances: Rebalance[] = [];
    const resupplies: Resupply[] = [];
    let totalConsumed = 0;
    let totalResupplied = 0;
    let totalTransferred = 0;

    // Step 1: Periodic Resupply
    if (day === 1 || day % resupplyInterval === 0) {
      dcs.forEach((dc) => {
        const amount = getResupplyAmount(dc, inventories[dc.id]);
        if (amount > 0) {
          const actual = Math.min(amount, dc.capacity - inventories[dc.id]);
          if (actual > 0) {
            inventories[dc.id] += actual;
            resupplies.push({ dcId: dc.id, name: dc.name, units: actual, day });
            totalResupplied += actual;
          }
        }
      });
    }

    // Step 2: Consume daily demand
    const demands: Record<string, number> = {};
    dcs.forEach((dc) => {
      const demand = getDailyDemand(dc, day);
      demands[dc.id] = demand;
      const consumed = Math.min(demand, inventories[dc.id]);
      inventories[dc.id] -= consumed;
      totalConsumed += consumed;
    });

    // Step 3: Proactive Rebalancing (3 passes)
    for (let pass = 0; pass < 3; pass++) {
      const states = dcs.map((dc) => {
        const demand = demands[dc.id];
        const coverage = demand > 0 ? inventories[dc.id] / demand : 999;
        return { dc, coverage, demand };
      });

      const needyDCs = states.filter((s) => s.coverage < 10).sort((a, b) => a.coverage - b.coverage);
      const surplusDCs = states.filter((s) => s.coverage > 14).sort((a, b) => b.coverage - a.coverage);

      for (const needy of needyDCs) {
        const targetInventory = needy.demand * 14;
        let deficit = Math.max(0, targetInventory - inventories[needy.dc.id]);
        if (deficit < 200) continue;

        for (const surplus of surplusDCs) {
          if (surplus.dc.id === needy.dc.id) continue;
          if (deficit <= 0) break;

          const lane = findLane(surplus.dc.id, needy.dc.id, lanes);
          if (!lane) continue;

          const surplusReserve = surplus.demand * 10;
          const available = Math.max(0, inventories[surplus.dc.id] - surplusReserve);
          const toSend = Math.min(deficit, available, 3000);

          if (toSend >= 200) {
            inventories[surplus.dc.id] -= toSend;
            inventories[needy.dc.id] += toSend;
            deficit -= toSend;
            totalTransferred += toSend;

            rebalances.push({
              from: surplus.dc.id,
              to: needy.dc.id,
              fromName: surplus.dc.name,
              toName: needy.dc.name,
              units: toSend,
              reason: `${needy.dc.name} had ${needy.coverage.toFixed(1)} days coverage → transferred from ${surplus.dc.name} (${surplus.coverage.toFixed(0)}d surplus)`,
              day,
              mode: lane.origin === surplus.dc.id ? 'truck' : 'truck',
            });
          }
        }
      }
    }

    // Step 4: Build snapshot
    const dcStates: DCDayState[] = dcs.map((dc) => {
      const demand = demands[dc.id];
      const coverage = demand > 0 ? inventories[dc.id] / demand : 999;

      let status: DCDayState['status'] = 'normal';
      if (coverage > 20) status = 'surplus';
      else if (coverage > 12) status = 'healthy';
      else if (coverage < 7) status = 'low';

      const dayResupply = resupplies.filter((r) => r.dcId === dc.id).reduce((s, r) => s + r.units, 0);
      const dayReceived = rebalances.filter((r) => r.to === dc.id).reduce((s, r) => s + r.units, 0);
      const daySent = rebalances.filter((r) => r.from === dc.id).reduce((s, r) => s + r.units, 0);

      return {
        id: dc.id,
        name: dc.name,
        inventory: inventories[dc.id],
        capacity: dc.capacity,
        dailyDemand: demand,
        consumed: demand,
        received: dayReceived,
        sent: daySent,
        resupplied: dayResupply,
        status,
        daysOfCoverage: coverage,
        lat: dc.lat,
        lng: dc.lng,
      };
    });

    const minCoverage = Math.min(...dcStates.map((d) => d.daysOfCoverage));
    const health: DaySnapshot['networkHealth'] =
      minCoverage > 10 ? 'excellent' : minCoverage > 5 ? 'good' : 'fair';

    snapshots.push({ day, dcStates, rebalances, resupplies, totalConsumed, totalResupplied, totalTransferred, networkHealth: health });
  }

  return snapshots;
}

// ─── Status/Health config ───

const statusConfig = {
  normal: { color: 'text-slate-400', border: 'border-slate-600', label: 'Normal', Icon: CheckCircle2 },
  low: { color: 'text-amber-400', border: 'border-amber-500/30', label: 'Low Stock', Icon: TrendingDown },
  healthy: { color: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Healthy', Icon: CheckCircle2 },
  surplus: { color: 'text-cyan-400', border: 'border-cyan-500/30', label: 'Surplus', Icon: TrendingUp },
};

const healthConfig = {
  excellent: { text: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Excellent' },
  good: { text: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Good' },
  fair: { text: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Fair' },
};

// ─── Component ───

export default function SimulationPage() {
  const [dcs, setDcs] = useState<DC[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [duration, setDuration] = useState(14);
  const [resupplyDays, setResupplyDays] = useState(15);
  const [selectedDay, setSelectedDay] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    fetchNetwork().then((data) => {
      setDcs(data.dcs);
      setLanes(data.lanes);
      setLoaded(true);
    });
  }, []);

  const simulation = useMemo(
    () => (loaded ? runSimulation(dcs, lanes, duration, resupplyDays) : []),
    [dcs, lanes, duration, resupplyDays, loaded]
  );

  const currentSnapshot = simulation[selectedDay - 1] || null;

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      if (selectedDay < duration) {
        setSelectedDay((d) => d + 1);
      } else {
        setIsPlaying(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isPlaying, selectedDay, duration]);

  // Aggregates
  const totalRebalances = simulation.reduce((s, snap) => s + snap.rebalances.length, 0);
  const totalUnitsRebalanced = simulation.reduce((s, snap) => s + snap.totalTransferred, 0);
  const totalResupplied = simulation.reduce((s, snap) => s + snap.totalResupplied, 0);
  const totalConsumed = simulation.reduce((s, snap) => s + snap.totalConsumed, 0);
  const excellentDays = simulation.filter((s) => s.networkHealth === 'excellent').length;
  const fairDays = simulation.filter((s) => s.networkHealth === 'fair').length;

  const selectClass = 'bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500';

  if (!loaded || !currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full mr-3" />
        Loading network data...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Demand Simulation</h2>
        <p className="text-slate-400 text-sm mt-1">
          Multi-day demand simulation with proactive rebalancing and periodic resupply
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">Period</label>
          <select
            value={duration}
            onChange={(e) => { setDuration(Number(e.target.value)); setSelectedDay(1); setIsPlaying(false); }}
            className={selectClass}
          >
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wide block mb-1">Resupply Interval</label>
          <select
            value={resupplyDays}
            onChange={(e) => { setResupplyDays(Number(e.target.value)); setSelectedDay(1); setIsPlaying(false); }}
            className={selectClass}
          >
            <option value={7}>Every 7 days</option>
            <option value={10}>Every 10 days</option>
            <option value={15}>Every 15 days</option>
            <option value={30}>Every 30 days</option>
          </select>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => { if (selectedDay >= duration) setSelectedDay(1); setIsPlaying(!isPlaying); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium ${isPlaying ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/20 text-cyan-400'}`}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            onClick={() => { setSelectedDay(1); setIsPlaying(false); setDuration(14); setResupplyDays(15); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-600 hover:bg-slate-700"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className={`text-xs font-medium px-2 py-1 rounded ${healthConfig[currentSnapshot.networkHealth].bg} ${healthConfig[currentSnapshot.networkHealth].text}`}>
            {healthConfig[currentSnapshot.networkHealth].label}
          </span>
          <Calendar size={14} className="text-slate-500" />
          <span className="text-sm font-semibold text-white">Day {selectedDay} / {duration}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Timeline</span>
          <div className="group relative">
            <Info size={12} className="text-slate-600 cursor-help" />
            <div className="absolute bottom-5 left-0 hidden group-hover:block bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-[10px] text-slate-300 w-64 z-10">
              Green = excellent. Blue = good. Yellow = fair. Dots show resupply (green) and rebalancing (blue) events.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-[9px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Excellent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Good</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Fair</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Resupply</span>
          </div>
        </div>
        <div className="flex gap-0.5 overflow-x-auto pb-1">
          {simulation.map((snap, i) => {
            const dayNum = i + 1;
            const isSelected = selectedDay === dayNum;
            const isPast = dayNum <= selectedDay;
            const hasResupply = snap.resupplies.length > 0;
            const hasRebalance = snap.rebalances.length > 0;

            // Only color days that have been "reached"
            let cellClass: string;
            if (isSelected) {
              cellClass = 'ring-2 ring-cyan-400 scale-110 z-10 bg-cyan-500/30 text-cyan-300';
            } else if (isPast) {
              cellClass = snap.networkHealth === 'excellent' ? 'bg-emerald-500/20 text-emerald-400'
                : snap.networkHealth === 'good' ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-amber-500/20 text-amber-400';
            } else {
              cellClass = 'bg-slate-800/40 text-slate-600';
            }

            return (
              <button
                key={i}
                onClick={() => { setSelectedDay(dayNum); setIsPlaying(false); }}
                className={`flex-shrink-0 w-8 h-10 rounded text-[8px] font-mono flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer hover:scale-105 hover:brightness-125 ${cellClass}`}
              >
                {dayNum}
                <div className="flex gap-0.5">
                  {hasResupply && isPast && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  {hasRebalance && isPast && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map + Day Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SimulationMap dcStates={currentSnapshot.dcStates} rebalances={currentSnapshot.rebalances} day={selectedDay} />
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 450 }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Day {selectedDay} Summary</h3>
              <p className="text-[10px] text-slate-500">
                Network: <span className={healthConfig[currentSnapshot.networkHealth].text + ' font-semibold'}>{healthConfig[currentSnapshot.networkHealth].label}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-800/50 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Consumed</p>
              <p className="text-sm font-bold text-white font-mono">{currentSnapshot.totalConsumed.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Resupplied</p>
              <p className="text-sm font-bold text-emerald-400 font-mono">{currentSnapshot.totalResupplied > 0 ? `+${currentSnapshot.totalResupplied.toLocaleString()}` : '—'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Transferred</p>
              <p className="text-sm font-bold text-cyan-400 font-mono">{currentSnapshot.totalTransferred > 0 ? currentSnapshot.totalTransferred.toLocaleString() : '—'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg px-3 py-2">
              <p className="text-[10px] uppercase text-slate-500">Rebalances</p>
              <p className="text-sm font-bold text-white font-mono">{currentSnapshot.rebalances.length}</p>
            </div>
          </div>
          {/* DC inventory bars */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Inventory (days left)</h4>
            <div className="space-y-2">
              {currentSnapshot.dcStates.map((dc) => {
                const pct = Math.min((dc.inventory / dc.capacity) * 100, 100);
                const barColor = dc.status === 'surplus' ? 'bg-cyan-500' : dc.status === 'healthy' ? 'bg-emerald-500' : dc.status === 'low' ? 'bg-amber-500' : 'bg-slate-500';
                return (
                  <div key={dc.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-semibold text-white">{dc.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {dc.inventory.toLocaleString()} · <span className={dc.daysOfCoverage < 7 ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {dc.daysOfCoverage > 99 ? '99+' : dc.daysOfCoverage.toFixed(0)}d
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Transfer routes */}
          {currentSnapshot.rebalances.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Transfer Routes</h4>
              <div className="space-y-1.5">
                {currentSnapshot.rebalances.map((r, i) => (
                  <div key={i} className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-white">{r.fromName.slice(0, 3)}</span>
                    <ArrowRight size={10} className="text-cyan-400" />
                    <span className="text-[10px] font-bold text-white">{r.toName.slice(0, 3)}</span>
                    <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 ml-auto">{r.units.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><Package size={12} /> TOTAL CONSUMED</div>
          <div className="text-xl font-bold text-white">{totalConsumed.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><ArrowDownToLine size={12} /> TOTAL RESUPPLIED</div>
          <div className="text-xl font-bold text-emerald-400">{totalResupplied.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><Truck size={12} /> TOTAL TRANSFERRED</div>
          <div className="text-xl font-bold text-cyan-400">{totalUnitsRebalanced.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><RefreshCw size={12} /> REBALANCE ACTIONS</div>
          <div className="text-xl font-bold text-white">{totalRebalances}</div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><CheckCircle2 size={12} /> EXCELLENT DAYS</div>
          <div className="text-xl font-bold text-emerald-400">{excellentDays} / {duration}</div>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1"><ShieldCheck size={12} /> NETWORK UPTIME</div>
          <div className={`text-xl font-bold ${fairDays === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {((1 - fairDays / duration) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Day flow bar */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">Day {selectedDay} Flow:</span>
          <span className="flex items-center gap-1.5 text-white">
            <ArrowDownToLine size={14} className="text-emerald-400" />
            <strong>{currentSnapshot.totalResupplied.toLocaleString()}</strong> resupplied
          </span>
          <span className="flex items-center gap-1.5 text-white">
            <Package size={14} className="text-slate-400" />
            <strong>{currentSnapshot.totalConsumed.toLocaleString()}</strong> consumed
          </span>
          <span className="flex items-center gap-1.5 text-white">
            <Truck size={14} className="text-cyan-400" />
            <strong>{currentSnapshot.totalTransferred.toLocaleString()}</strong> transferred
          </span>
          <span className="flex items-center gap-1.5 text-white">
            <RefreshCw size={14} className="text-slate-400" />
            <strong>{currentSnapshot.rebalances.length}</strong> rebalance{currentSnapshot.rebalances.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Resupply notice */}
      {currentSnapshot.resupplies.length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 border-l-4 border-l-emerald-500 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownToLine size={14} className="text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Resupply Day — Incoming Goods</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {currentSnapshot.resupplies.map((r, i) => (
              <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-xs font-semibold text-white">{r.name}</span>
                <span className="text-[10px] text-emerald-400 font-mono">+{r.units.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DC Status Cards + Rebalancing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-3">DC Inventory — Day {selectedDay}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {currentSnapshot.dcStates.map((dc) => {
              const config = statusConfig[dc.status];
              const Icon = config.Icon;
              const utilPct = Math.min((dc.inventory / dc.capacity) * 100, 100);
              const barColor = utilPct > 80 ? 'bg-cyan-500' : utilPct > 50 ? 'bg-emerald-500' : utilPct > 25 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={dc.id} className={`bg-slate-900 rounded-xl border border-slate-700 border-l-4 ${config.border} p-4`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={config.color} />
                      <span className="text-sm font-bold text-white">{dc.name}</span>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full border ${config.border} ${config.color}`}>{config.label}</span>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-500">Inventory</span>
                      <span className="font-mono text-white">{dc.inventory.toLocaleString()} / {dc.capacity.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all duration-300`} style={{ width: `${utilPct}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono">
                    <div className="flex justify-between"><span className="text-slate-500">Demand:</span><span className="text-white">-{dc.dailyDemand.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Resupply:</span><span className={dc.resupplied > 0 ? 'text-emerald-400 font-bold' : 'text-slate-600'}>{dc.resupplied > 0 ? `+${dc.resupplied.toLocaleString()}` : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Received:</span><span className={dc.received > 0 ? 'text-cyan-400 font-bold' : 'text-slate-600'}>{dc.received > 0 ? `+${dc.received.toLocaleString()}` : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Sent:</span><span className={dc.sent > 0 ? 'text-amber-400' : 'text-slate-600'}>{dc.sent > 0 ? `-${dc.sent.toLocaleString()}` : '—'}</span></div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-700 flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Days of Coverage</span>
                    <span className={`text-sm font-bold font-mono ${dc.daysOfCoverage > 14 ? 'text-emerald-400' : dc.daysOfCoverage > 7 ? 'text-cyan-400' : 'text-amber-400'}`}>
                      {dc.daysOfCoverage > 99 ? '99+' : dc.daysOfCoverage.toFixed(1)}d
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rebalance Actions */}
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Truck size={14} className="text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Rebalance Actions</h3>
            </div>
            {currentSnapshot.rebalances.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">All DCs adequately stocked</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentSnapshot.rebalances.map((r, i) => (
                  <div key={i} className="border border-cyan-500/20 bg-cyan-500/5 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-white">{r.fromName}</span>
                      <ArrowRight size={12} className="text-cyan-400" />
                      <span className="text-xs font-bold text-white">{r.toName}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">{r.units.toLocaleString()} units</span>
                      <span className="text-[9px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded capitalize">{r.mode}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Inventory Trend */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-3">Inventory Trend</h3>
            <div className="overflow-auto">
              <table className="w-full text-[9px] font-mono">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-1 text-slate-500 font-normal">DC</th>
                    {Array.from({ length: Math.min(7, selectedDay) }).map((_, i) => {
                      const d = Math.max(1, selectedDay - Math.min(6, selectedDay - 1) + i);
                      return <th key={i} className={`text-right py-1 px-1 ${d === selectedDay ? 'text-cyan-400 font-bold' : 'text-slate-500 font-normal'}`}>D{d}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dcs.map((dc) => (
                    <tr key={dc.id} className="border-b border-slate-800">
                      <td className="py-1 text-white">{dc.name.slice(0, 3)}</td>
                      {Array.from({ length: Math.min(7, selectedDay) }).map((_, i) => {
                        const d = Math.max(1, selectedDay - Math.min(6, selectedDay - 1) + i);
                        const snap = simulation[d - 1];
                        const inv = snap?.dcStates.find((s) => s.id === dc.id)?.inventory || 0;
                        return (
                          <td key={i} className={`text-right py-1 px-1 ${d === selectedDay ? 'text-white font-bold' : 'text-slate-500'}`}>
                            {(inv / 1000).toFixed(0)}K
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Transfer Log */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Complete Transfer Log</h3>
          <span className="text-[9px] px-2 py-0.5 rounded border border-slate-600 text-slate-400 ml-auto">
            {totalRebalances} transfers · {totalUnitsRebalanced.toLocaleString()} units
          </span>
        </div>
        <div className="max-h-[350px] overflow-y-auto">
          {totalRebalances === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={24} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No inter-DC transfers needed</p>
            </div>
          ) : (
            <div className="space-y-1">
              {simulation.flatMap((snap) => snap.rebalances).map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-slate-800/50 border-b border-slate-800 last:border-0">
                  <span className="text-[9px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 w-14 text-center flex-shrink-0">Day {r.day}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-xs w-36">
                    <span className="font-semibold text-white">{r.fromName}</span>
                    <ArrowRight size={10} className="text-slate-500" />
                    <span className="font-semibold text-white">{r.toName}</span>
                  </div>
                  <span className="text-[9px] border border-slate-600 px-2 py-0.5 rounded text-slate-300 flex-shrink-0">{r.units.toLocaleString()}</span>
                  <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 flex-shrink-0 capitalize">{r.mode}</span>
                  <p className="text-[10px] text-slate-500 truncate">{r.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
