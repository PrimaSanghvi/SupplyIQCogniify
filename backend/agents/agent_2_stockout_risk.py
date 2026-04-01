from agents.base import BaseAgent, PipelineContext
from agents.models import StockoutRiskResult, DCStockoutRisk, CurrentPictureResult

# Scenario-specific variability factors
SCENARIO_FACTORS = {
    "early_bird": {
        "DC-CHI": ["Freight rate spike imminent (4x increase in 2 days)", "Regional labor strike risk"],
    },
    "long_haul": {
        "DC-SEA": ["Extended lead times from west coast ports", "Winter weather disruption risk"],
        "DC-LAX": ["Tier-1 customer reservation locks 2,000 units"],
    },
    "overstock": {
        "DC-CHI": ["Regional promotion starting in 5 days (+4,000 unit demand surge)", "Holiday season peak"],
    },
}


class StockoutRiskAgent(BaseAgent):
    name = "Stockout Risk"
    agent_id = 2

    async def run(self, context: PipelineContext) -> StockoutRiskResult:
        agent1_result: CurrentPictureResult = context.get_result(1)
        scenario_id = context.scenario.id if context.scenario else ""

        dc_risks = []
        critical_dcs = []

        for summary in agent1_result.dc_summaries:
            if summary.demand_forecast == 0:
                ratio = 999.0
            else:
                ratio = summary.net_available / summary.demand_forecast

            # Heuristic risk scoring
            if ratio < 0.5:
                probability = 0.85 + (0.5 - ratio) * 0.2  # 0.85-0.95
                risk_level = "CRITICAL"
            elif ratio < 0.8:
                probability = 0.4 + (0.8 - ratio) * 0.67  # 0.4-0.6
                risk_level = "HIGH"
            elif ratio < 1.0:
                probability = 0.15 + (1.0 - ratio) * 1.25  # 0.15-0.4
                risk_level = "MEDIUM"
            else:
                probability = max(0.02, 0.15 - (ratio - 1.0) * 0.1)
                risk_level = "LOW"

            probability = min(probability, 0.99)

            # Days of supply (assuming monthly demand cycle = 30 days)
            daily_demand = summary.demand_forecast / 30.0
            days_of_supply = round(summary.net_available / daily_demand, 1) if daily_demand > 0 else 999.0

            # Variability factors
            factors = []
            if risk_level in ("HIGH", "CRITICAL"):
                factors.append(f"Supply/demand ratio: {ratio:.2f}")
                factors.append(f"Only {days_of_supply:.0f} days of supply remaining")

            # Add scenario-specific factors
            scenario_dc_factors = SCENARIO_FACTORS.get(scenario_id, {}).get(summary.id, [])
            factors.extend(scenario_dc_factors)

            if risk_level in ("HIGH", "CRITICAL"):
                critical_dcs.append(summary.id)

            dc_risks.append(DCStockoutRisk(
                id=summary.id,
                name=summary.name,
                stockout_probability=round(probability, 3),
                risk_level=risk_level,
                days_of_supply=days_of_supply,
                variability_factors=factors,
            ))

        # Sort by risk (highest first)
        dc_risks.sort(key=lambda r: r.stockout_probability, reverse=True)

        # Insight
        critical_count = len(critical_dcs)
        high_risks = [r for r in dc_risks if r.risk_level in ("HIGH", "CRITICAL")]

        prompt = (
            f"Summarize stockout risk for a supply chain executive in 2-3 sentences:\n"
            f"- {critical_count} DCs at HIGH/CRITICAL risk: {', '.join(r.name for r in high_risks)}\n"
            f"- Highest risk: {dc_risks[0].name} at {dc_risks[0].stockout_probability:.0%} probability, "
            f"{dc_risks[0].days_of_supply:.0f} days of supply\n"
            f"- Key factors: {'; '.join(dc_risks[0].variability_factors[:2])}\n"
        )
        insight = await self.get_llm_insight(prompt)

        if not insight:
            if critical_count > 0:
                names = ", ".join(r.name for r in high_risks)
                worst = dc_risks[0]
                insight = (
                    f"{critical_count} DC(s) at elevated stockout risk: {names}. "
                    f"{worst.name} is most critical at {worst.stockout_probability:.0%} probability "
                    f"with only {worst.days_of_supply:.0f} days of supply. "
                    f"Immediate rebalancing action recommended."
                )
            else:
                insight = "All DCs are within acceptable risk thresholds. No immediate action required."

        return StockoutRiskResult(
            dc_risks=dc_risks,
            critical_dcs=critical_dcs,
            insight=insight,
        )
