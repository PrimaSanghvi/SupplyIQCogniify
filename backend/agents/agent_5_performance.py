from agents.base import BaseAgent, PipelineContext
from agents.models import (
    PerformanceResult, KPIMetric,
    StockoutRiskResult, RebalancingResult,
)


class PerformanceAgent(BaseAgent):
    name = "Performance"
    agent_id = 5

    async def run(self, context: PipelineContext) -> PerformanceResult:
        agent2: StockoutRiskResult = context.get_result(2)
        agent4: RebalancingResult = context.get_result(4)

        opt = agent4.optimization_result
        transfers = opt.transfers
        critical_dcs = set(agent2.critical_dcs)

        # Which critical DCs received inbound transfers?
        served_dcs = set()
        for t in transfers:
            if t.destination in critical_dcs:
                served_dcs.add(t.destination)

        # Metrics
        if critical_dcs:
            sourcing_effectiveness = round(len(served_dcs) / len(critical_dcs), 3)
            stockout_prediction_accuracy = round(
                len(served_dcs & critical_dcs) / len(critical_dcs), 3
            )
        else:
            sourcing_effectiveness = 1.0
            stockout_prediction_accuracy = 1.0

        total_cost = opt.objective_value
        cost_efficiency = round(total_cost / context.budget_ceiling, 3) if context.budget_ceiling > 0 else 0.0

        total_units = sum(t.units for t in transfers)
        total_carbon = opt.total_carbon_kg
        carbon_efficiency = round(total_carbon / total_units, 2) if total_units > 0 else 0.0

        unresolved = list(critical_dcs - served_dcs)

        # KPIs
        kpis = [
            KPIMetric(
                name="Fill Rate Improvement",
                value=round(sourcing_effectiveness * 100, 1),
                unit="%",
                trend="UP" if sourcing_effectiveness > 0.5 else "FLAT",
            ),
            KPIMetric(
                name="Total Units Moved",
                value=float(total_units),
                unit="units",
                trend="UP",
            ),
            KPIMetric(
                name="Cost per Unit Moved",
                value=round(total_cost / total_units, 2) if total_units > 0 else 0,
                unit="$/unit",
                trend="DOWN",
            ),
            KPIMetric(
                name="Carbon per Unit",
                value=carbon_efficiency,
                unit="kg CO2/unit",
                trend="DOWN",
            ),
            KPIMetric(
                name="Budget Utilization",
                value=round(cost_efficiency * 100, 1),
                unit="%",
                trend="FLAT",
            ),
            KPIMetric(
                name="Risks Resolved",
                value=float(len(served_dcs)),
                unit=f"of {len(critical_dcs)}",
                trend="UP" if len(served_dcs) == len(critical_dcs) else "FLAT",
            ),
        ]

        # Insight
        prompt = (
            f"Summarize rebalancing performance for a supply chain executive in 2-3 sentences:\n"
            f"- Sourcing effectiveness: {sourcing_effectiveness:.0%} of at-risk DCs served\n"
            f"- {len(served_dcs)}/{len(critical_dcs)} critical DCs received stock\n"
            f"- Total cost: ${total_cost:,.0f} ({cost_efficiency:.0%} of budget)\n"
            f"- Carbon footprint: {total_carbon:,.0f} kg CO2 ({carbon_efficiency:.1f} kg/unit)\n"
            f"- Unresolved: {', '.join(unresolved) if unresolved else 'None'}\n"
        )
        insight = await self.get_llm_insight(prompt)

        if not insight:
            if unresolved:
                insight = (
                    f"Rebalancing addressed {len(served_dcs)} of {len(critical_dcs)} at-risk DCs "
                    f"({sourcing_effectiveness:.0%} effectiveness). "
                    f"Unresolved: {', '.join(unresolved)}. "
                    f"Total cost ${total_cost:,.0f} ({cost_efficiency:.0%} of budget), "
                    f"carbon footprint {total_carbon:,.0f} kg CO2."
                )
            else:
                insight = (
                    f"All {len(critical_dcs)} at-risk DCs successfully served. "
                    f"Total cost ${total_cost:,.0f} ({cost_efficiency:.0%} of budget), "
                    f"carbon footprint {total_carbon:,.0f} kg CO2 ({carbon_efficiency:.1f} kg/unit)."
                )

        return PerformanceResult(
            stockout_prediction_accuracy=stockout_prediction_accuracy,
            sourcing_effectiveness=sourcing_effectiveness,
            cost_efficiency=cost_efficiency,
            carbon_efficiency=carbon_efficiency,
            unresolved_risks=unresolved,
            kpis=kpis,
            insight=insight,
        )
