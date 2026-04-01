import sys
import os
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import DistributionCenter, Lane, Scenario


class PipelineContext:
    """Shared context that accumulates outputs from each agent."""

    def __init__(
        self,
        dcs: list,
        lanes: list,
        scenario: Optional[Scenario],
        weights: dict,
        budget_ceiling: float,
    ):
        self.dcs = dcs
        self.lanes = lanes
        self.scenario = scenario
        self.weights = weights
        self.budget_ceiling = budget_ceiling
        self._results: Dict[int, Any] = {}

    def set_result(self, agent_id: int, result: Any):
        self._results[agent_id] = result

    def get_result(self, agent_id: int) -> Any:
        return self._results.get(agent_id)


class BaseAgent(ABC):
    name: str = ""
    agent_id: int = 0

    @abstractmethod
    async def run(self, context: PipelineContext) -> Any:
        """Execute agent logic, return structured output."""
        pass

    async def get_llm_insight(self, prompt: str) -> str:
        """Call LLama for a narrative insight, with empty-string fallback."""
        try:
            from explainer import call_llm
            result = await call_llm(prompt)
            if result:
                return result
        except Exception:
            pass
        return ""
