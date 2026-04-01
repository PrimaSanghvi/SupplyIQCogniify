export interface Transfer {
  origin: string;
  destination: string;
  units: number;
  cost: number;
  carbon_kg: number;
}

export interface CostBreakdown {
  transport: number;
  holding: number;
  stockout_penalty: number;
  overflow_penalty: number;
}

export interface DCStateAfter {
  id: string;
  name: string;
  stock_before: number;
  stock_after: number;
  capacity: number;
  demand_forecast: number;
  utilization_pct: number;
}

export interface OptimizationResult {
  status: string;
  objective_value: number;
  transfers: Transfer[];
  cost_breakdown: CostBreakdown;
  dc_states_after: DCStateAfter[];
  shadow_prices: Record<string, number>;
  total_carbon_kg: number;
}

export interface ComparisonResult {
  intuitive: OptimizationResult;
  optimized: OptimizationResult;
  savings: {
    cost: number;
    transport: number;
    stockout_penalty: number;
    carbon_kg: number;
  };
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface Weights {
  cost: number;
  carbon: number;
  service_risk: number;
}

export interface ParetoStrategyResult {
  strategy_name: string;
  strategy_description: string;
  weights: Weights;
  result: OptimizationResult;
}

export interface Movement {
  index: number;
  origin: string;
  destination: string;
  mode: 'truck' | 'rail' | 'intermodal';
  units: number;
  cost: number;
  cost_per_unit: number;
  carbon_kg: number;
  carbon_per_unit: number;
  flag: 'Standard' | 'Anomaly';
}

export interface MovementsSummary {
  total_cost: number;
  total_carbon_kg: number;
  total_carbon_tonnes: number;
  total_units: number;
  anomaly_count: number;
  avg_cost_per_unit: number;
  avg_carbon_per_unit_kg: number;
}

export interface MovementsResponse {
  movements: Movement[];
  summary: MovementsSummary;
}
