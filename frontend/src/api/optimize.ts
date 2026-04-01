import type { OptimizationResult, ComparisonResult, Weights, ParetoStrategyResult, MovementsResponse } from '../types/optimization';

export async function runOptimization(
  weights: Weights,
  scenarioId?: string,
  budgetCeiling: number = 100000,
): Promise<OptimizationResult> {
  const res = await fetch('/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_id: scenarioId,
      weights,
      budget_ceiling: budgetCeiling,
    }),
  });
  return res.json();
}

export async function runComparison(
  scenarioId: string,
  weights: Weights,
  budgetCeiling: number = 100000,
): Promise<ComparisonResult> {
  const res = await fetch('/api/optimize/compare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_id: scenarioId,
      weights,
      budget_ceiling: budgetCeiling,
    }),
  });
  return res.json();
}

export async function fetchPareto(
  scenarioId?: string,
  budgetCeiling: number = 100000,
): Promise<ParetoStrategyResult[]> {
  const res = await fetch('/api/pareto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_id: scenarioId || null,
      budget_ceiling: budgetCeiling,
    }),
  });
  return res.json();
}

export async function fetchMovements(
  scenarioId?: string,
  weights: Weights = { cost: 0.5, carbon: 0.3, service_risk: 0.2 },
  budgetCeiling: number = 100000,
): Promise<MovementsResponse> {
  const res = await fetch('/api/movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario_id: scenarioId || null,
      weights,
      budget_ceiling: budgetCeiling,
    }),
  });
  return res.json();
}
