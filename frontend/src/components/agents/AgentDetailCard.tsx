import { ArrowRight, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type {
  CurrentPictureResult,
  StockoutRiskResult,
  SourceOptionsResult,
  RebalancingResult,
  PerformanceResult,
} from '../../types/agents';

function Agent1Detail({ data }: { data: CurrentPictureResult }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-slate-400">Supply</div>
          <div className="text-white font-semibold">{data.network_total_supply.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-slate-400">Demand</div>
          <div className="text-white font-semibold">{data.network_total_demand.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-slate-400">Balance</div>
          <div className={`font-semibold ${data.network_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.network_balance > 0 ? '+' : ''}{data.network_balance.toLocaleString()}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        {data.dc_summaries.map((dc) => (
          <div key={dc.id} className="flex items-center justify-between text-xs bg-slate-800/50 rounded px-2 py-1">
            <span className="text-slate-300">{dc.name}</span>
            <span className={`font-medium ${dc.surplus_deficit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {dc.surplus_deficit > 0 ? '+' : ''}{dc.surplus_deficit.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Agent2Detail({ data }: { data: StockoutRiskResult }) {
  const riskColors: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    HIGH: 'bg-orange-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-green-500',
  };

  return (
    <div className="space-y-1">
      {data.dc_risks.map((risk) => (
        <div key={risk.id} className="flex items-center gap-2 text-xs bg-slate-800/50 rounded px-2 py-1.5">
          <span className={`w-2 h-2 rounded-full ${riskColors[risk.risk_level] || 'bg-gray-500'}`} />
          <span className="text-slate-300 min-w-[70px]">{risk.name}</span>
          <span className={`font-medium ${
            risk.risk_level === 'CRITICAL' ? 'text-red-400' :
            risk.risk_level === 'HIGH' ? 'text-orange-400' :
            risk.risk_level === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {(risk.stockout_probability * 100).toFixed(0)}%
          </span>
          <span className="text-slate-500 ml-auto">{risk.days_of_supply.toFixed(0)}d supply</span>
        </div>
      ))}
      {data.critical_dcs.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
          <AlertTriangle size={12} />
          {data.critical_dcs.length} DC(s) need immediate action
        </div>
      )}
    </div>
  );
}

function Agent3Detail({ data }: { data: SourceOptionsResult }) {
  return (
    <div className="space-y-1">
      {data.recommended_sources.map((opt, i) => (
        <div key={i} className="flex items-center gap-1 text-xs bg-slate-800/50 rounded px-2 py-1.5">
          <span className="text-cyan-400 font-medium">{opt.source_dc_name}</span>
          <ArrowRight size={10} className="text-slate-500" />
          <span className="text-cyan-400 font-medium">{opt.target_dc_name}</span>
          <span className="text-slate-400 ml-auto">{opt.available_units.toLocaleString()} units</span>
          <span className="text-slate-500">${opt.transport_cost_per_unit}/u</span>
        </div>
      ))}
      {data.options.filter(o => o.option_type === 'SPOT_PURCHASE').length > 0 && (
        <div className="text-xs text-slate-500 mt-1">
          + {data.options.filter(o => o.option_type === 'SPOT_PURCHASE').length} spot purchase backup(s)
        </div>
      )}
    </div>
  );
}

function Agent4Detail({ data }: { data: RebalancingResult }) {
  return (
    <div className="space-y-1">
      {data.transfer_orders.map((t, i) => (
        <div key={i} className="text-xs bg-slate-800/50 rounded px-2 py-1.5">
          <div className="flex items-center gap-1">
            <span className="text-cyan-400 font-medium">{t.origin}</span>
            <ArrowRight size={10} className="text-slate-500" />
            <span className="text-cyan-400 font-medium">{t.destination}</span>
            <span className="text-white font-medium ml-auto">{t.units.toLocaleString()} units</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px]">
            <span className={`px-1.5 py-0.5 rounded ${
              t.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {t.status}
            </span>
            <span className="text-slate-500">{t.eligibility_check}</span>
          </div>
        </div>
      ))}
      <div className="text-xs text-slate-400 mt-1">
        Total: ${data.optimization_result.objective_value.toLocaleString()}
      </div>
    </div>
  );
}

function Agent5Detail({ data }: { data: PerformanceResult }) {
  const trendIcon = (trend: string) => {
    if (trend === 'UP') return <TrendingUp size={10} className="text-green-400" />;
    if (trend === 'DOWN') return <TrendingDown size={10} className="text-red-400" />;
    return <Minus size={10} className="text-slate-500" />;
  };

  return (
    <div className="grid grid-cols-2 gap-1">
      {data.kpis.map((kpi) => (
        <div key={kpi.name} className="bg-slate-800/50 rounded px-2 py-1.5 text-xs">
          <div className="text-slate-500 text-[10px]">{kpi.name}</div>
          <div className="flex items-center gap-1">
            <span className="text-white font-medium">
              {typeof kpi.value === 'number' && kpi.value % 1 !== 0
                ? kpi.value.toFixed(1)
                : kpi.value.toLocaleString()}
            </span>
            <span className="text-slate-500">{kpi.unit}</span>
            {trendIcon(kpi.trend)}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  agentId: number;
  output: Record<string, unknown>;
}

export default function AgentDetailCard({ agentId, output }: Props) {
  switch (agentId) {
    case 1: return <Agent1Detail data={output as unknown as CurrentPictureResult} />;
    case 2: return <Agent2Detail data={output as unknown as StockoutRiskResult} />;
    case 3: return <Agent3Detail data={output as unknown as SourceOptionsResult} />;
    case 4: return <Agent4Detail data={output as unknown as RebalancingResult} />;
    case 5: return <Agent5Detail data={output as unknown as PerformanceResult} />;
    default: return null;
  }
}
