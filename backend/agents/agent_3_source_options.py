from agents.base import BaseAgent, PipelineContext
from agents.models import (
    SourceOptionsResult, SourceOption,
    CurrentPictureResult, StockoutRiskResult,
)


class SourceOptionsAgent(BaseAgent):
    name = "Source Options"
    agent_id = 3

    async def run(self, context: PipelineContext) -> SourceOptionsResult:
        agent1: CurrentPictureResult = context.get_result(1)
        agent2: StockoutRiskResult = context.get_result(2)

        # Build lookups
        dc_map = {dc.id: dc for dc in context.dcs}
        summary_map = {s.id: s for s in agent1.dc_summaries}
        lane_map = {}
        for lane in context.lanes:
            lane_map[(lane.origin, lane.destination)] = lane

        # Identify surplus and deficit DCs
        surplus_dcs = [s for s in agent1.dc_summaries if s.surplus_deficit > 0]
        critical_dc_ids = set(agent2.critical_dcs)

        options = []

        for critical_id in critical_dc_ids:
            target_summary = summary_map[critical_id]
            target_dc = dc_map[critical_id]
            deficit = abs(target_summary.surplus_deficit)

            for surplus in surplus_dcs:
                source_dc = dc_map[surplus.id]
                lane = lane_map.get((surplus.id, critical_id))
                if not lane:
                    continue

                available = min(surplus.surplus_deficit, deficit)
                if available <= 0:
                    continue

                # Feasibility score: higher is better
                # Factors: available units, transit speed, cost efficiency
                unit_score = min(available / deficit, 1.0) * 0.4
                speed_score = max(0, 1.0 - lane.transit_days / 7.0) * 0.3
                cost_score = max(0, 1.0 - lane.transport_cost_per_unit / 10.0) * 0.3
                feasibility = round(unit_score + speed_score + cost_score, 3)

                options.append(SourceOption(
                    source_dc_id=surplus.id,
                    source_dc_name=surplus.name,
                    target_dc_id=critical_id,
                    target_dc_name=target_dc.name,
                    available_units=available,
                    transport_cost_per_unit=lane.transport_cost_per_unit,
                    transit_days=lane.transit_days,
                    carbon_kg_per_unit=lane.carbon_kg_per_unit,
                    option_type="INTERNAL_REDEPLOY",
                    feasibility_score=feasibility,
                ))

            # Add synthetic SPOT_PURCHASE option for each critical DC
            best_lane_cost = min(
                (l.transport_cost_per_unit for l in context.lanes if l.destination == critical_id),
                default=5.0,
            )
            options.append(SourceOption(
                source_dc_id="SPOT",
                source_dc_name="Spot Market",
                target_dc_id=critical_id,
                target_dc_name=target_dc.name,
                available_units=deficit,
                transport_cost_per_unit=round(best_lane_cost * 2.0, 2),
                transit_days=1,
                carbon_kg_per_unit=50.0,
                option_type="SPOT_PURCHASE",
                feasibility_score=0.2,
            ))

        # Sort by feasibility
        options.sort(key=lambda o: o.feasibility_score, reverse=True)

        # Top recommendations: best option per target DC (internal only)
        recommended = []
        seen_targets = set()
        for opt in options:
            if opt.option_type == "INTERNAL_REDEPLOY" and opt.target_dc_id not in seen_targets:
                recommended.append(opt)
                seen_targets.add(opt.target_dc_id)

        # Insight
        if recommended:
            rec_lines = "; ".join(
                f"{r.source_dc_name}→{r.target_dc_name} ({r.available_units:,} units, "
                f"${r.transport_cost_per_unit}/unit, {r.transit_days}d)"
                for r in recommended
            )
            prompt = (
                f"Summarize sourcing recommendations for a supply chain executive in 2-3 sentences:\n"
                f"- {len(options)} total options identified ({len([o for o in options if o.option_type == 'INTERNAL_REDEPLOY'])} internal, "
                f"{len([o for o in options if o.option_type == 'SPOT_PURCHASE'])} spot purchase)\n"
                f"- Top recommendations: {rec_lines}\n"
            )
            insight = await self.get_llm_insight(prompt)

            if not insight:
                insight = (
                    f"Identified {len(options)} sourcing options. "
                    f"Top recommendations: {rec_lines}. "
                    f"Spot purchases available as backup at 2x cost."
                )
        else:
            insight = "No viable internal redeployment sources found. Consider spot purchases or demand reallocation."

        return SourceOptionsResult(
            options=options,
            recommended_sources=recommended,
            insight=insight,
        )
