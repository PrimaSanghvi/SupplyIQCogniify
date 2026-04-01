import json
import sys
import os
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base import PipelineContext
from agents.agent_1_current_picture import CurrentPictureAgent
from agents.agent_2_stockout_risk import StockoutRiskAgent
from agents.agent_3_source_options import SourceOptionsAgent
from agents.agent_4_rebalancing import RebalancingAgent
from agents.agent_5_performance import PerformanceAgent
from data import get_distribution_centers, get_lanes, get_scenario


def sse_event(event_type: str, payload: dict) -> str:
    data = {"event": event_type, **payload}
    return f"data: {json.dumps(data)}\n\n"


async def run_pipeline(
    scenario_id: Optional[str],
    weights: dict,
    budget_ceiling: float,
):
    """Async generator that runs 5 agents sequentially, yielding SSE events."""

    # Load data
    if scenario_id:
        scenario = get_scenario(scenario_id)
        if scenario:
            dcs = scenario.dcs
            lanes = scenario.lanes
        else:
            dcs = get_distribution_centers()
            lanes = get_lanes()
            scenario = None
    else:
        dcs = get_distribution_centers()
        lanes = get_lanes()
        scenario = None

    context = PipelineContext(
        dcs=dcs,
        lanes=lanes,
        scenario=scenario,
        weights=weights,
        budget_ceiling=budget_ceiling,
    )

    agents = [
        CurrentPictureAgent(),
        StockoutRiskAgent(),
        SourceOptionsAgent(),
        RebalancingAgent(),
        PerformanceAgent(),
    ]

    for agent in agents:
        # Signal agent started
        yield sse_event("agent_start", {
            "agent_id": agent.agent_id,
            "name": agent.name,
        })

        try:
            result = await agent.run(context)
            context.set_result(agent.agent_id, result)

            yield sse_event("agent_complete", {
                "agent_id": agent.agent_id,
                "name": agent.name,
                "output": result.model_dump(),
            })
        except Exception as e:
            yield sse_event("agent_error", {
                "agent_id": agent.agent_id,
                "name": agent.name,
                "error": str(e),
            })

    yield sse_event("pipeline_complete", {"status": "done"})
