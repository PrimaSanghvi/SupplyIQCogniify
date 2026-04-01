import { useState, useEffect, useCallback } from 'react';
import { runPipeline } from '../api/pipeline';
import { fetchScenarios } from '../api/network';
import type { OptimizationResult, ScenarioSummary, Weights } from '../types/optimization';
import type { AgentEvent } from '../types/agents';
import WeightSliders from '../components/optimizer/WeightSliders';
import ResultsPanel from '../components/optimizer/ResultsPanel';
import AgentPipeline from '../components/agents/AgentPipeline';
import ParetoTable from '../components/optimizer/ParetoTable';

export default function OptimizerPage() {
  const [weights, setWeights] = useState<Weights>({ cost: 0.5, carbon: 0.3, service_risk: 0.2 });
  const [scenarioId, setScenarioId] = useState<string>('');
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [agentOutputs, setAgentOutputs] = useState<Record<number, Record<string, unknown>>>({});
  const [agentErrors, setAgentErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchScenarios().then(setScenarios);
  }, []);

  const handleOptimize = useCallback(async (w: Weights, sid: string) => {
    setLoading(true);
    setAgentStep(0);
    setAgentOutputs({});
    setAgentErrors({});
    setResult(null);

    const handleEvent = (event: AgentEvent) => {
      switch (event.event) {
        case 'agent_start':
          setAgentStep(event.agent_id);
          break;
        case 'agent_complete':
          setAgentOutputs((prev) => ({ ...prev, [event.agent_id]: event.output! }));
          // Extract optimization result from Agent 4
          if (event.agent_id === 4 && event.output) {
            const rebalancing = event.output as { optimization_result?: OptimizationResult };
            if (rebalancing.optimization_result) {
              setResult(rebalancing.optimization_result);
            }
          }
          break;
        case 'agent_error':
          setAgentErrors((prev) => ({ ...prev, [event.agent_id]: event.error || 'Unknown error' }));
          break;
        case 'pipeline_complete':
          setLoading(false);
          setAgentStep(6); // Past last agent
          break;
      }
    };

    try {
      await runPipeline(w, handleEvent, sid || undefined);
    } catch {
      setLoading(false);
    }
  }, []);

  // Debounced optimize on slider change
  useEffect(() => {
    const timer = setTimeout(() => {
      handleOptimize(weights, scenarioId);
    }, 500);
    return () => clearTimeout(timer);
  }, [weights, scenarioId, handleOptimize]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Strategic Optimizer</h2>
        <p className="text-slate-400 text-sm mt-1">
          Adjust strategy weights and watch 5 agents analyze, evaluate, and optimize in real-time
        </p>
      </div>

      <AgentPipeline
        currentStep={agentStep}
        agentOutputs={agentOutputs}
        agentErrors={agentErrors}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <WeightSliders weights={weights} onChange={setWeights} />

          {/* Scenario selector */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
            <label className="text-sm text-slate-400 block mb-2">Scenario</label>
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">Base Network</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="lg:col-span-2">
          {loading && !result ? (
            <div className="text-center py-16 text-slate-400">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-3" />
              Agents analyzing network...
            </div>
          ) : result ? (
            <ResultsPanel result={result} />
          ) : null}
        </div>
      </div>

      {result && !loading && <ParetoTable scenarioId={scenarioId} />}
    </div>
  );
}
