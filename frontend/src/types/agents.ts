// ─── Agent 1: Current Picture ───
export interface DCSupplyDemandSummary {
  id: string;
  name: string;
  on_hand: number;
  safety_stock: number;
  net_available: number;
  demand_forecast: number;
  surplus_deficit: number;
}

export interface CurrentPictureResult {
  dc_summaries: DCSupplyDemandSummary[];
  network_total_supply: number;
  network_total_demand: number;
  network_balance: number;
  insight: string;
}

// ─── Agent 2: Stockout Risk ───
export interface DCStockoutRisk {
  id: string;
  name: string;
  stockout_probability: number;
  risk_level: string;
  days_of_supply: number;
  variability_factors: string[];
}

export interface StockoutRiskResult {
  dc_risks: DCStockoutRisk[];
  critical_dcs: string[];
  insight: string;
}

// ─── Agent 3: Source Options ───
export interface SourceOption {
  source_dc_id: string;
  source_dc_name: string;
  target_dc_id: string;
  target_dc_name: string;
  available_units: number;
  transport_cost_per_unit: number;
  transit_days: number;
  carbon_kg_per_unit: number;
  option_type: string;
  feasibility_score: number;
}

export interface SourceOptionsResult {
  options: SourceOption[];
  recommended_sources: SourceOption[];
  insight: string;
}

// ─── Agent 4: Rebalancing ───
export interface TransferOrder {
  origin: string;
  destination: string;
  units: number;
  cost: number;
  carbon_kg: number;
  status: string;
  eligibility_check: string;
}

export interface RebalancingResult {
  optimization_result: import('./optimization').OptimizationResult;
  transfer_orders: TransferOrder[];
  insight: string;
}

// ─── Agent 5: Performance ───
export interface KPIMetric {
  name: string;
  value: number;
  unit: string;
  trend: string;
}

export interface PerformanceResult {
  stockout_prediction_accuracy: number;
  sourcing_effectiveness: number;
  cost_efficiency: number;
  carbon_efficiency: number;
  unresolved_risks: string[];
  kpis: KPIMetric[];
  insight: string;
}

// ─── Pipeline Events ───
export interface AgentEvent {
  event: 'agent_start' | 'agent_complete' | 'agent_error' | 'pipeline_complete';
  agent_id: number;
  name: string;
  output?: Record<string, unknown>;
  error?: string;
}
