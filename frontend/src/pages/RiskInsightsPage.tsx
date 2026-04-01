import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle, ShieldCheck, TrendingDown, CheckCircle2,
  CloudSnow, Package, Ship, BarChart3, Lightbulb, Target, Info, Eye, EyeOff, SlidersHorizontal
} from 'lucide-react';
import { fetchNetwork } from '../api/network';
import { fetchScenarios } from '../api/network';
import type { DC, Lane } from '../types/network';
import type { ScenarioSummary } from '../types/optimization';

// ─── Risk Event Types ───

interface RiskEvent {
  id: string;
  dcId: string;
  type: 'stockout' | 'weather' | 'demand_surge' | 'port_delay';
  probability: number;
  impact: string;
  penaltyCost: number;
  description: string;
}

// ─── Risk Events per scenario ───

const BASE_RISK_EVENTS: RiskEvent[] = [
  {
    id: 'risk-chi-stockout',
    dcId: 'DC-CHI',
    type: 'stockout',
    probability: 0.95,
    impact: 'critical',
    penaltyCost: 15000,
    description: 'Chicago DC has only 2,200 units against 6,000 demand forecast. Supply/demand ratio of 0.37 indicates imminent stockout without rebalancing.',
  },
  {
    id: 'risk-sea-weather',
    dcId: 'DC-SEA',
    type: 'weather',
    probability: 0.70,
    impact: 'severe',
    penaltyCost: 12000,
    description: '70% probability of major winter storm affecting Pacific Northwest. Expected 3-5 day transit disruption on all inbound lanes to Seattle.',
  },
  {
    id: 'risk-nyc-surge',
    dcId: 'DC-NYC',
    type: 'demand_surge',
    probability: 0.45,
    impact: 'moderate',
    penaltyCost: 8000,
    description: 'Holiday demand surge expected in Northeast corridor. New York DC projected to exceed forecast by 25%, straining current inventory levels.',
  },
  {
    id: 'risk-lax-port',
    dcId: 'DC-LAX',
    type: 'port_delay',
    probability: 0.30,
    impact: 'moderate',
    penaltyCost: 5000,
    description: 'Port congestion at Long Beach causing 2-day delays on inbound container shipments. Los Angeles DC resupply timeline extended.',
  },
];

const SCENARIO_RISK_EVENTS: Record<string, RiskEvent[]> = {
  early_bird: [
    { id: 'risk-chi-stockout-eb', dcId: 'DC-CHI', type: 'stockout', probability: 0.92, impact: 'critical', penaltyCost: 18000, description: 'Chicago faces imminent shortage. Freight rates on ATL→CHI lane about to spike 4x due to regional labor strike — shipping now avoids $15K extra transport cost.' },
    { id: 'risk-atl-surge-eb', dcId: 'DC-ATL', type: 'demand_surge', probability: 0.35, impact: 'moderate', penaltyCost: 6000, description: 'Atlanta surplus stock being drawn down for early shipments. Monitor demand to avoid over-depleting Atlanta inventory.' },
    { id: 'risk-sea-weather-eb', dcId: 'DC-SEA', type: 'weather', probability: 0.60, impact: 'severe', penaltyCost: 10000, description: 'Winter weather risk on west coast lanes. Seattle has low stock (1,500 units) and limited inbound options.' },
  ],
  long_haul: [
    { id: 'risk-sea-stockout-lh', dcId: 'DC-SEA', type: 'stockout', probability: 0.90, impact: 'critical', penaltyCost: 16000, description: 'Seattle has only 1,500 units against 4,000 demand. Must source from Dallas (2,150 mi) because LA stock is reserved for Tier-1 customer.' },
    { id: 'risk-lax-commitment-lh', dcId: 'DC-LAX', type: 'demand_surge', probability: 0.80, impact: 'critical', penaltyCost: 50000, description: 'Los Angeles has 7,000 units but ALL committed — 4,500 to demand + 2,000 reserved for Tier-1 customer order. Pulling stock risks $50K revenue loss.' },
    { id: 'risk-nyc-surge-lh', dcId: 'DC-NYC', type: 'demand_surge', probability: 0.40, impact: 'moderate', penaltyCost: 7000, description: 'New York demand forecast (5,500) exceeds current stock (5,000). Moderate risk of shortage without rebalancing.' },
  ],
  overstock: [
    { id: 'risk-chi-promo-os', dcId: 'DC-CHI', type: 'demand_surge', probability: 0.95, impact: 'critical', penaltyCost: 45000, description: 'Regional promotion starts in 5 days projecting +4,000 extra demand at Chicago. Current stock (9,200) cannot cover it. Stockout during promo = $45K lost sales.' },
    { id: 'risk-chi-overflow-os', dcId: 'DC-CHI', type: 'stockout', probability: 0.40, impact: 'moderate', penaltyCost: 7500, description: 'Shipping more stock to Chicago pushes it to 105% capacity. Overflow storage costs $3/unit/day but is far cheaper than lost sales during the promotion.' },
    { id: 'risk-sea-weather-os', dcId: 'DC-SEA', type: 'weather', probability: 0.55, impact: 'moderate', penaltyCost: 8000, description: 'Moderate weather disruption risk on Pacific Northwest lanes could delay transfers needed for Seattle replenishment.' },
  ],
};

// ─── Analysis Engine ───

interface RiskAnalysis {
  risk: RiskEvent;
  dc: DC;
  rootCause: string;
  impact: string;
  recommendations: { action: string; priority: 'high' | 'medium' | 'low'; savings: string }[];
  riskScore: number;
  utilization: number;
  daysOfCoverage: number;
}

function analyzeRisk(risk: RiskEvent, dcs: DC[], lanes: Lane[]): RiskAnalysis | null {
  const dc = dcs.find((d) => d.id === risk.dcId);
  if (!dc) return null;

  const utilization = (dc.current_stock / dc.capacity) * 100;
  const dailyDemand = dc.demand_forecast / 30;
  const daysOfCoverage = dailyDemand > 0 ? dc.current_stock / dailyDemand : 999;
  const riskScore = risk.probability * risk.penaltyCost;

  const inboundLanes = lanes.filter((l) => l.destination === risk.dcId);
  const surplusDCs = dcs.filter((d) => d.id !== risk.dcId && d.current_stock / d.capacity > 0.6);

  let rootCause = '';
  let impact = '';
  let recommendations: RiskAnalysis['recommendations'] = [];

  switch (risk.type) {
    case 'stockout':
      rootCause = `${dc.name} has only ${daysOfCoverage.toFixed(1)} days of inventory coverage against a monthly demand forecast of ${dc.demand_forecast.toLocaleString()} units. Current inventory (${dc.current_stock.toLocaleString()}) is dangerously close to the safety stock threshold (${dc.safety_stock.toLocaleString()}).`;
      impact = `If stockout occurs, the penalty cost is $${risk.penaltyCost.toLocaleString()} per shortage event. With ${(risk.probability * 100).toFixed(0)}% probability, the expected loss is $${riskScore.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`;
      recommendations = [
        {
          action: `Emergency restock from ${surplusDCs[0]?.name || 'nearest surplus DC'}: Transfer ${Math.min(3000, dc.demand_forecast).toLocaleString()} units immediately to restore 14-day coverage`,
          priority: 'high',
          savings: `Avoids $${risk.penaltyCost.toLocaleString()} stockout penalty`,
        },
        {
          action: `Increase safety stock at ${dc.name} from ${dc.safety_stock.toLocaleString()} to ${Math.round(dc.safety_stock * 1.5).toLocaleString()} units to prevent future shortages`,
          priority: 'medium',
          savings: `Reduces future stockout probability by ~40%`,
        },
        {
          action: `Set up demand surge alerts: Monitor daily consumption and trigger auto-rebalancing when inventory falls below ${Math.round(dc.demand_forecast * 0.4).toLocaleString()} units`,
          priority: 'medium',
          savings: `Early warning reduces reaction time by 2-3 days`,
        },
      ];
      break;

    case 'weather':
      rootCause = `A weather event threatens inbound supply lines to ${dc.name}. ${inboundLanes.length} inbound lanes are at risk of disruption. ${dc.name} is currently at ${utilization.toFixed(0)}% capacity utilization with ${daysOfCoverage.toFixed(0)} days of coverage.`;
      impact = `Transit disruption could last 3-5 days, cutting off resupply. With current demand of ${dailyDemand.toFixed(0)} units/day, ${dc.name} will deplete its buffer inventory within ${daysOfCoverage.toFixed(0)} days.`;
      recommendations = [
        {
          action: `Pre-position ${Math.round(dc.demand_forecast * 0.3).toLocaleString()} units at ${dc.name} BEFORE the weather event hits using proactive rebalancing`,
          priority: 'high',
          savings: `Avoids $${risk.penaltyCost.toLocaleString()} penalty + $${Math.round(risk.penaltyCost * 0.3).toLocaleString()} in emergency air freight`,
        },
        {
          action: `Switch to alternative inbound lanes from ${surplusDCs.slice(0, 2).map((d) => d.name).join(' or ') || 'available surplus DCs'} with higher reliability`,
          priority: 'high',
          savings: `Maintains supply continuity during disruption`,
        },
        {
          action: `Establish forward stock buffer: Maintain 10+ days of coverage at ${dc.name} during winter months (current: ${daysOfCoverage.toFixed(1)} days)`,
          priority: 'medium',
          savings: `Reduces weather risk impact by 60-70%`,
        },
      ];
      break;

    case 'demand_surge':
      rootCause = `A demand surge is projected at ${dc.name}, expected to exceed the forecast by 25-50%. Current inventory of ${dc.current_stock.toLocaleString()} units may not sustain the elevated demand rate. The surge is likely driven by seasonal patterns or promotional activity.`;
      impact = `Without intervention, ${dc.name} could stockout ${daysOfCoverage.toFixed(0)} days into the surge. Each day of stockout costs approximately $${Math.round(risk.penaltyCost / 5).toLocaleString()} in lost sales and expedited shipping.`;
      recommendations = [
        {
          action: `Pre-ship ${Math.round(dc.demand_forecast * 0.3).toLocaleString()} additional units from ${surplusDCs.map((d) => d.name).slice(0, 2).join(' or ') || 'nearest surplus DC'} within 48 hours`,
          priority: 'high',
          savings: `Captures $${Math.round(risk.penaltyCost * 0.7).toLocaleString()} in revenue that would otherwise be lost`,
        },
        {
          action: `Activate overflow storage at ${dc.name}: Temporarily increase capacity ceiling by 10% (${Math.round(dc.capacity * 0.1).toLocaleString()} units) to accommodate pre-positioning`,
          priority: 'medium',
          savings: `Storage premium ~$${Math.round(dc.holding_cost_per_unit * dc.capacity * 0.1).toLocaleString()} vs $${risk.penaltyCost.toLocaleString()} stockout cost`,
        },
        {
          action: `Coordinate with sales team: Consider inventory allocation if demand exceeds ${Math.round(dc.demand_forecast * 1.3).toLocaleString()} units to prevent network-wide disruption`,
          priority: 'low',
          savings: `Prevents cascade stockouts across the network`,
        },
      ];
      break;

    case 'port_delay':
      rootCause = `Port congestion is causing delays on inbound shipments to ${dc.name}. Estimated delay: 2-4 days on top of normal transit times. ${inboundLanes.length} inbound lanes are potentially affected.`;
      impact = `Delayed resupply means ${dc.name} must rely on existing inventory for ${Math.round(daysOfCoverage + 3)} days instead of ${daysOfCoverage.toFixed(0)} days. If inventory drops below safety stock (${dc.safety_stock.toLocaleString()} units), penalty is $${risk.penaltyCost.toLocaleString()}.`;
      recommendations = [
        {
          action: `Redirect inbound shipments to alternative modes: Switch affected lanes from intermodal/sea to truck or rail from domestic DCs`,
          priority: 'high',
          savings: `Eliminates 2-4 day delay, cost premium ~$${Math.round(dc.demand_forecast * 0.15).toLocaleString()}`,
        },
        {
          action: `Pull forward scheduled replenishment orders by 3 days to offset the port delay`,
          priority: 'medium',
          savings: `Maintains continuous supply at minimal incremental cost`,
        },
        {
          action: `Monitor port congestion KPIs daily and set up automated lane-switching when delays exceed 48 hours`,
          priority: 'low',
          savings: `Proactive vs reactive: saves 1-2 days of response time`,
        },
      ];
      break;
  }

  return { risk, dc, rootCause, impact, recommendations, riskScore, utilization, daysOfCoverage };
}

// ─── Constants ───

const typeIcon = {
  weather: CloudSnow,
  stockout: Package,
  demand_surge: BarChart3,
  port_delay: Ship,
};

const typeLabel: Record<string, string> = {
  stockout: 'STOCKOUT',
  weather: 'WEATHER DISRUPTION',
  demand_surge: 'DEMAND SURGE',
  port_delay: 'PORT DELAY',
};

const priorityStyles = {
  high: 'text-red-400 border-red-500/30 bg-red-500/5',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
  low: 'text-slate-400 border-slate-600 bg-slate-800/50',
};

const priorityBadge = {
  high: 'text-red-400 border-red-500/40',
  medium: 'text-amber-400 border-amber-500/40',
  low: 'text-slate-400 border-slate-600',
};

// ─── Component ───

export default function RiskInsightsPage() {
  const [dcs, setDcs] = useState<DC[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState('');

  // Interactive: probability overrides and toggles
  const [probOverrides, setProbOverrides] = useState<Record<string, number>>({});
  const [disabledRisks, setDisabledRisks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchNetwork().then((data) => {
      setDcs(data.dcs);
      setLanes(data.lanes);
      setLoaded(true);
    });
    fetchScenarios().then(setScenarios);
  }, []);

  // Fetch scenario-specific DC data when scenario changes
  useEffect(() => {
    if (!scenarioId) {
      fetchNetwork().then((data) => {
        setDcs(data.dcs);
        setLanes(data.lanes);
      });
    } else {
      fetch(`/api/scenarios/${scenarioId}`).then((r) => r.json()).then((data) => {
        if (data.dcs) setDcs(data.dcs);
        if (data.lanes) setLanes(data.lanes);
      });
    }
    // Reset overrides and toggles when scenario changes
    setProbOverrides({});
    setDisabledRisks(new Set());
  }, [scenarioId]);

  // Get risk events for current scenario
  const riskEvents = useMemo(() => {
    if (scenarioId && SCENARIO_RISK_EVENTS[scenarioId]) {
      return SCENARIO_RISK_EVENTS[scenarioId];
    }
    return BASE_RISK_EVENTS;
  }, [scenarioId]);

  // Apply probability overrides
  const adjustedRiskEvents = useMemo(() => {
    return riskEvents.map((r) => ({
      ...r,
      probability: probOverrides[r.id] !== undefined ? probOverrides[r.id] : r.probability,
    }));
  }, [riskEvents, probOverrides]);

  const analyses = useMemo(() => {
    if (!loaded) return [];
    return adjustedRiskEvents
      .filter((r) => !disabledRisks.has(r.id))
      .map((r) => analyzeRisk(r, dcs, lanes))
      .filter(Boolean) as RiskAnalysis[];
  }, [dcs, lanes, loaded, adjustedRiskEvents, disabledRisks]);

  const sorted = useMemo(() => [...analyses].sort((a, b) => b.riskScore - a.riskScore), [analyses]);

  const totalExposure = sorted.reduce((s, a) => s + a.riskScore, 0);
  const highRisks = sorted.filter((a) => a.risk.probability > 0.6).length;
  const mitigationPotential = sorted.reduce((s, a) => s + a.riskScore * 0.7, 0);
  const totalRecs = sorted.reduce((s, a) => s + a.recommendations.length, 0);
  const disabledCount = disabledRisks.size;

  const toggleRisk = (id: string) => {
    setDisabledRisks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectClass = 'bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500';

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full mr-3" />
        Loading risk data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-white">Risk Intelligence</h2>
          <div className="group relative">
            <Info size={16} className="text-slate-500 cursor-help" />
            <div className="absolute bottom-6 left-0 hidden group-hover:block bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 w-80 z-10">
              Root cause analysis, impact assessment, and actionable mitigation strategies for every active risk in the network. Adjust probability sliders to model scenarios, toggle risks on/off to see mitigation impact.
            </div>
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1">
          Root cause analysis, impact assessment, and actionable mitigation strategies for every active risk
        </p>
      </div>

      {/* Controls: Scenario + Risk Toggles + Sliders */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">
          <SlidersHorizontal size={12} /> Risk Controls
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Scenario selector */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">SCENARIO</label>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={selectClass + ' w-full'}>
              <option value="">Base Network</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Right: Risk toggles */}
          <div>
            <label className="text-xs text-slate-500 block mb-1">TOGGLE RISKS (click to enable/disable)</label>
            <div className="flex flex-wrap gap-2">
              {riskEvents.map((r) => {
                const isDisabled = disabledRisks.has(r.id);
                const RiskIcon = typeIcon[r.type];
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRisk(r.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isDisabled
                        ? 'bg-slate-800/50 text-slate-600 border border-slate-700 line-through'
                        : 'bg-slate-800 text-slate-200 border border-slate-600 hover:border-cyan-500/50'
                    }`}
                  >
                    {isDisabled ? <EyeOff size={11} /> : <Eye size={11} />}
                    <RiskIcon size={11} />
                    {r.dcId.replace('DC-', '')} {r.type.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Probability sliders */}
        <div className="mt-4 pt-3 border-t border-slate-700">
          <label className="text-xs text-slate-500 block mb-2">PROBABILITY ADJUSTMENT</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {riskEvents.map((r) => {
              const isDisabled = disabledRisks.has(r.id);
              const currentProb = probOverrides[r.id] !== undefined ? probOverrides[r.id] : r.probability;
              const isModified = probOverrides[r.id] !== undefined && probOverrides[r.id] !== r.probability;
              return (
                <div key={r.id} className={`${isDisabled ? 'opacity-30 pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-slate-400">
                      {r.dcId.replace('DC-', '')} · {r.type.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${currentProb > 0.6 ? 'text-red-400' : currentProb > 0.3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {(currentProb * 100).toFixed(0)}%
                      {isModified && <span className="text-slate-600 ml-1">(was {(r.probability * 100).toFixed(0)}%)</span>}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(currentProb * 100)}
                    onChange={(e) => setProbOverrides((prev) => ({ ...prev, [r.id]: Number(e.target.value) / 100 }))}
                    className="w-full"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Active Risks</span>
          </div>
          <span className="text-2xl font-bold text-white">{sorted.length}</span>
          <span className="text-xs text-slate-500 ml-2">{highRisks} critical{disabledCount > 0 ? ` · ${disabledCount} disabled` : ''}</span>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-amber-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Total Exposure</span>
          </div>
          <span className="text-2xl font-bold text-white">${(totalExposure / 1000).toFixed(1)}K</span>
          <span className="text-xs text-slate-500 ml-2">expected loss</span>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Mitigation Potential</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">${(mitigationPotential / 1000).toFixed(1)}K</span>
          <span className="text-xs text-slate-500 ml-2">saveable</span>
        </div>
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={14} className="text-cyan-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Recommendations</span>
          </div>
          <span className="text-2xl font-bold text-white">{totalRecs}</span>
          <span className="text-xs text-slate-500 ml-2">actions</span>
        </div>
      </div>

      {/* Risk Analysis Cards */}
      <div className="space-y-5">
        {sorted.map((analysis) => {
          const Icon = typeIcon[analysis.risk.type];
          const severityBorder = analysis.risk.probability > 0.6 ? 'border-l-red-500' : analysis.risk.probability > 0.3 ? 'border-l-amber-500' : 'border-l-slate-600';
          const iconBg = analysis.risk.probability > 0.6 ? 'bg-red-500/10' : 'bg-amber-500/10';
          const iconColor = analysis.risk.probability > 0.6 ? 'text-red-400' : 'text-amber-400';

          return (
            <div key={analysis.risk.id} className={`bg-slate-900 rounded-xl border border-slate-700 border-l-4 ${severityBorder} overflow-hidden`}>
              {/* Header */}
              <div className="p-5 border-b border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
                    <Icon size={18} className={iconColor} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white">
                        {analysis.dc.name} — {typeLabel[analysis.risk.type]}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${analysis.risk.probability > 0.6 ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>
                        {(analysis.risk.probability * 100).toFixed(0)}% Probability
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
                        Exposure: ${analysis.riskScore.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{analysis.risk.description}</p>
                  </div>
                </div>

                {/* DC Quick Stats */}
                <div className="flex gap-4 text-[10px] font-mono mt-3 bg-slate-800/50 rounded-lg px-3 py-2 flex-wrap">
                  <span className="text-slate-500">Inventory: <strong className="text-white">{analysis.dc.current_stock.toLocaleString()}</strong></span>
                  <span className="text-slate-500">Capacity: <strong className="text-white">{analysis.utilization.toFixed(0)}%</strong></span>
                  <span className="text-slate-500">Coverage: <strong className={analysis.daysOfCoverage < 7 ? 'text-red-400' : 'text-emerald-400'}>{analysis.daysOfCoverage.toFixed(1)} days</strong></span>
                  <span className="text-slate-500">Safety Stock: <strong className="text-white">{analysis.dc.safety_stock.toLocaleString()}</strong></span>
                  <span className="text-slate-500">Holding: <strong className="text-white">${analysis.dc.holding_cost_per_unit}/unit</strong></span>
                </div>
              </div>

              {/* Root Cause + Impact */}
              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-700">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Root Cause Analysis</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{analysis.rootCause}</p>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={14} className="text-red-400" />
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Financial Impact</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{analysis.impact}</p>
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-5 bg-slate-800/20 border-t border-slate-700">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb size={14} className="text-cyan-400" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Recommended Actions</h4>
                </div>
                <div className="space-y-2.5">
                  {analysis.recommendations.map((rec, j) => (
                    <div key={j} className={`border rounded-lg p-3 ${priorityStyles[rec.priority]}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${priorityBadge[rec.priority]}`}>
                          {rec.priority.toUpperCase()}
                        </span>
                        <CheckCircle2 size={12} className="text-slate-600 ml-auto" />
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{rec.action}</p>
                      <p className="text-[10px] text-slate-500 mt-1 italic">{rec.savings}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
