from agents.base import BaseAgent, PipelineContext
from agents.models import CurrentPictureResult, DCSupplyDemandSummary


class CurrentPictureAgent(BaseAgent):
    name = "Current Picture"
    agent_id = 1

    async def run(self, context: PipelineContext) -> CurrentPictureResult:
        summaries = []
        total_supply = 0
        total_demand = 0

        for dc in context.dcs:
            net_available = dc.current_stock - dc.safety_stock
            surplus_deficit = net_available - dc.demand_forecast
            total_supply += dc.current_stock
            total_demand += dc.demand_forecast

            summaries.append(DCSupplyDemandSummary(
                id=dc.id,
                name=dc.name,
                on_hand=dc.current_stock,
                safety_stock=dc.safety_stock,
                net_available=net_available,
                demand_forecast=dc.demand_forecast,
                surplus_deficit=surplus_deficit,
            ))

        network_balance = total_supply - total_demand
        surplus_dcs = [s for s in summaries if s.surplus_deficit > 0]
        deficit_dcs = [s for s in summaries if s.surplus_deficit < 0]

        # Try LLM insight
        prompt = (
            f"Summarize this inventory network in 2-3 sentences for a supply chain executive:\n"
            f"- Total supply: {total_supply:,} units across {len(context.dcs)} DCs\n"
            f"- Total demand: {total_demand:,} units\n"
            f"- Network balance: {network_balance:+,} units\n"
            f"- Surplus DCs: {', '.join(f'{s.name} (+{s.surplus_deficit:,})' for s in surplus_dcs)}\n"
            f"- Deficit DCs: {', '.join(f'{s.name} ({s.surplus_deficit:,})' for s in deficit_dcs)}\n"
        )
        insight = await self.get_llm_insight(prompt)

        if not insight:
            surplus_names = ", ".join(f"{s.name} (+{s.surplus_deficit:,})" for s in surplus_dcs)
            deficit_names = ", ".join(f"{s.name} ({s.surplus_deficit:,})" for s in deficit_dcs)
            insight = (
                f"The network has {total_supply:,} units of supply against {total_demand:,} units of demand "
                f"({network_balance:+,} net). "
                f"Surplus positions at {surplus_names}. "
                f"Deficit positions at {deficit_names}."
            )

        return CurrentPictureResult(
            dc_summaries=summaries,
            network_total_supply=total_supply,
            network_total_demand=total_demand,
            network_balance=network_balance,
            insight=insight,
        )
