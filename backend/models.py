from pydantic import BaseModel
from typing import Optional


class DistributionCenter(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    capacity: int
    current_stock: int
    demand_forecast: int
    holding_cost_per_unit: float
    safety_stock: int = 0


class Lane(BaseModel):
    origin: str
    destination: str
    distance_miles: float
    transport_cost_per_unit: float
    carbon_kg_per_unit: float
    transit_days: int
    mode: str = "truck"  # "truck" | "rail" | "intermodal"


class TransferRecommendation(BaseModel):
    origin: str
    destination: str
    units: int
    cost: float
    carbon_kg: float


class CostBreakdown(BaseModel):
    transport: float
    holding: float
    stockout_penalty: float
    overflow_penalty: float = 0.0


class DCStateAfter(BaseModel):
    id: str
    name: str
    stock_before: int
    stock_after: int
    capacity: int
    demand_forecast: int
    utilization_pct: float


class OptimizationResult(BaseModel):
    status: str
    objective_value: float
    transfers: list[TransferRecommendation]
    cost_breakdown: CostBreakdown
    dc_states_after: list[DCStateAfter]
    shadow_prices: dict = {}
    total_carbon_kg: float = 0.0


class ScenarioSummary(BaseModel):
    id: str
    name: str
    description: str
    icon: str


class Scenario(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    executive_concern: str
    ai_logic: str
    intuitive_move: dict
    dcs: list[DistributionCenter]
    lanes: list[Lane]


class OptimizeRequest(BaseModel):
    scenario_id: Optional[str] = None
    weights: dict = {"cost": 0.5, "carbon": 0.3, "service_risk": 0.2}
    budget_ceiling: float = 100000.0


class CompareRequest(BaseModel):
    scenario_id: str
    weights: dict = {"cost": 0.5, "carbon": 0.3, "service_risk": 0.2}
    budget_ceiling: float = 100000.0


class ComparisonResult(BaseModel):
    intuitive: OptimizationResult
    optimized: OptimizationResult
    savings: dict


class ChatRequest(BaseModel):
    message: str
    scenario_id: Optional[str] = None
    optimization_result: Optional[dict] = None
    conversation_history: list[dict] = []
    summary: str = ""
    recent_messages: list[dict] = []


class Movement(BaseModel):
    index: int
    origin: str
    destination: str
    mode: str
    units: int
    cost: float
    cost_per_unit: float
    carbon_kg: float
    carbon_per_unit: float
    flag: str  # "Standard" | "Anomaly"


class MovementsResponse(BaseModel):
    movements: list[Movement]
    summary: dict


class SummarizeRequest(BaseModel):
    messages: list[dict]
