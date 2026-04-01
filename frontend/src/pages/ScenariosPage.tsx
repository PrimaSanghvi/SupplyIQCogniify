import { useEffect, useState } from 'react';
import { fetchScenarios } from '../api/network';
import { runComparison } from '../api/optimize';
import type { ScenarioSummary, ComparisonResult } from '../types/optimization';
import ScenarioCard from '../components/scenarios/ScenarioCard';
import ComparisonView from '../components/scenarios/ComparisonView';

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchScenarios().then(setScenarios);
  }, []);

  const handleSelect = async (id: string) => {
    setSelected(id);
    setLoading(true);
    const result = await runComparison(id, { cost: 0.5, carbon: 0.3, service_risk: 0.2 });
    setComparison(result);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Counter-Intuitive Scenarios</h2>
        <p className="text-slate-400 text-sm mt-1">
          See how the optimizer makes decisions that seem wrong but save money
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((s) => (
          <ScenarioCard
            key={s.id}
            scenario={s}
            isSelected={selected === s.id}
            onSelect={() => handleSelect(s.id)}
          />
        ))}
      </div>

      {loading && (
        <div className="text-center py-12 text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-3" />
          Running optimization comparison...
        </div>
      )}

      {comparison && !loading && selected && (
        <ComparisonView
          comparison={comparison}
          scenario={scenarios.find((s) => s.id === selected)!}
        />
      )}
    </div>
  );
}
