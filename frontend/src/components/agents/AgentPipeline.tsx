import { useState } from 'react';
import { Eye, AlertTriangle, Search, Play, BarChart3, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import AgentDetailCard from './AgentDetailCard';

const AGENTS = [
  { id: 1, name: 'Current Picture', desc: 'Supply & demand scan', Icon: Eye },
  { id: 2, name: 'Stockout Risk', desc: 'Probability analysis', Icon: AlertTriangle },
  { id: 3, name: 'Source Options', desc: 'Redeployment paths', Icon: Search },
  { id: 4, name: 'Rebalancing', desc: 'Execute transfers', Icon: Play },
  { id: 5, name: 'Performance', desc: 'Accuracy tracking', Icon: BarChart3 },
];

function getAgentSummary(agentId: number, output: Record<string, unknown>): string {
  switch (agentId) {
    case 1: {
      const balance = output.network_balance as number;
      return `${balance >= 0 ? '+' : ''}${balance?.toLocaleString()} net balance`;
    }
    case 2: {
      const critical = output.critical_dcs as string[];
      return critical?.length > 0 ? `${critical.length} DC(s) at risk` : 'All clear';
    }
    case 3: {
      const recs = output.recommended_sources as unknown[];
      return `${recs?.length || 0} source(s) found`;
    }
    case 4: {
      const opt = output.optimization_result as Record<string, unknown>;
      return `$${(opt?.objective_value as number)?.toLocaleString()} total cost`;
    }
    case 5: {
      const eff = output.sourcing_effectiveness as number;
      return `${((eff || 0) * 100).toFixed(0)}% effectiveness`;
    }
    default:
      return '';
  }
}

interface Props {
  currentStep: number;
  agentOutputs: Record<number, Record<string, unknown>>;
  agentErrors: Record<number, string>;
}

export default function AgentPipeline({ currentStep, agentOutputs, agentErrors }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
      <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Agent Pipeline</div>

      {/* Compact pipeline strip */}
      <div className="flex items-center gap-1 mb-2">
        {AGENTS.map((agent, i) => {
          const isActive = agent.id === currentStep;
          const isComplete = !!agentOutputs[agent.id];
          const hasError = !!agentErrors[agent.id];

          return (
            <div key={agent.id} className="flex items-center flex-1">
              <button
                onClick={() => isComplete ? setExpanded(expanded === agent.id ? null : agent.id) : null}
                className={`flex-1 rounded-lg px-2 py-1.5 text-center transition-all duration-300 ${
                  isActive
                    ? 'bg-cyan-500/20 border border-cyan-500/50'
                    : isComplete
                    ? 'bg-emerald-500/10 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/20'
                    : hasError
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'bg-slate-800/50 border border-slate-700'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  {isActive ? (
                    <Loader2 size={12} className="text-cyan-400 animate-spin" />
                  ) : isComplete ? (
                    <CheckCircle2 size={12} className="text-emerald-400" />
                  ) : hasError ? (
                    <XCircle size={12} className="text-red-400" />
                  ) : (
                    <agent.Icon size={12} className="text-slate-500" />
                  )}
                </div>
                <div className={`text-[10px] font-medium ${
                  isActive ? 'text-cyan-400' : isComplete ? 'text-emerald-400' : hasError ? 'text-red-400' : 'text-slate-500'
                }`}>
                  {agent.name}
                </div>
                {isComplete && (
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {getAgentSummary(agent.id, agentOutputs[agent.id])}
                  </div>
                )}
              </button>
              {i < AGENTS.length - 1 && (
                <div className={`w-3 h-0.5 mx-0.5 transition-colors ${isComplete ? 'bg-emerald-500' : 'bg-slate-700'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded detail card */}
      {expanded && agentOutputs[expanded] && (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-sm font-medium text-white">
                {AGENTS.find(a => a.id === expanded)?.name}
              </span>
            </div>
            <button onClick={() => setExpanded(null)} className="text-slate-400 hover:text-white">
              <ChevronUp size={14} />
            </button>
          </div>

          {/* Insight */}
          {(agentOutputs[expanded] as Record<string, unknown>).insight && (
            <div className="text-xs text-slate-300 bg-slate-800/50 rounded-lg p-2.5 mb-2 leading-relaxed">
              {String((agentOutputs[expanded] as Record<string, unknown>).insight)}
            </div>
          )}

          {/* Structured output */}
          <AgentDetailCard agentId={expanded} output={agentOutputs[expanded]} />
        </div>
      )}
    </div>
  );
}
