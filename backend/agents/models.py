from pydantic import BaseModel
from typing import List, Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models import OptimizationResult


# ─── Agent 1: Current Picture ───

class DCSupplyDemandSummary(BaseModel):
    id: str
    name: str
    on_hand: int
    safety_stock: int
    net_available: int
    demand_forecast: int
    surplus_deficit: int


class CurrentPictureResult(BaseModel):
    dc_summaries: List[DCSupplyDemandSummary]
    network_total_supply: int
    network_total_demand: int
    network_balance: int
    insight: str


# ─── Agent 2: Stockout Risk ───

class DCStockoutRisk(BaseModel):
    id: str
    name: str
    stockout_probability: float
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    days_of_supply: float
    variability_factors: List[str]


class StockoutRiskResult(BaseModel):
    dc_risks: List[DCStockoutRisk]
    critical_dcs: List[str]
    insight: str


# ─── Agent 3: Source Options ───

class SourceOption(BaseModel):
    source_dc_id: str
    source_dc_name: str
    target_dc_id: str
    target_dc_name: str
    available_units: int
    transport_cost_per_unit: float
    transit_days: int
    carbon_kg_per_unit: float
    option_type: str  # INTERNAL_REDEPLOY, SPOT_PURCHASE, EOL_HARVEST, SUBSTITUTE
    feasibility_score: float


class SourceOptionsResult(BaseModel):
    options: List[SourceOption]
    recommended_sources: List[SourceOption]
    insight: str


# ─── Agent 4: Rebalancing ───

class TransferOrder(BaseModel):
    origin: str
    destination: str
    units: int
    cost: float
    carbon_kg: float
    status: str  # RECOMMENDED, APPROVED, PENDING_APPROVAL
    eligibility_check: str


class RebalancingResult(BaseModel):
    optimization_result: OptimizationResult
    transfer_orders: List[TransferOrder]
    insight: str


# ─── Agent 5: Performance ───

class KPIMetric(BaseModel):
    name: str
    value: float
    unit: str
    trend: str  # UP, DOWN, FLAT


class PerformanceResult(BaseModel):
    stockout_prediction_accuracy: float
    sourcing_effectiveness: float
    cost_efficiency: float
    carbon_efficiency: float
    unresolved_risks: List[str]
    kpis: List[KPIMetric]
    insight: str
