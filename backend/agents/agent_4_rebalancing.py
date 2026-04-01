import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.base import BaseAgent, PipelineContext
from agents.models import RebalancingResult, TransferOrder
from optimizer import solve_redeployment


class RebalancingAgent(BaseAgent):
    name = "Rebalancing"
    agent_id = 4

    async def run(self, context: PipelineContext) -> RebalancingResult:
        # Run the LP solver
        result = solve_redeployment(
            context.dcs,
            context.lanes,
            context.weights,
            context.budget_ceiling,
        )

        # Map transfers to TransferOrders with eligibility checks
        transfer_orders = []
        for t in result.transfers:
            # Synthetic eligibility checks
            if t.units > 2000:
                eligibility = "Requires regional manager approval (>2,000 units)"
                status = "PENDING_APPROVAL"
            elif t.units > 1000:
                eligibility = "Auto-approved with notification to logistics lead"
                status = "APPROVED"
            else:
                eligibility = "Auto-approved, standard transfer"
                status = "APPROVED"

            transfer_orders.append(TransferOrder(
                origin=t.origin,
                destination=t.destination,
                units=t.units,
                cost=t.cost,
                carbon_kg=t.carbon_kg,
                status=status,
                eligibility_check=eligibility,
            ))

        # Insight
        total_units = sum(t.units for t in transfer_orders)
        total_cost = result.cost_breakdown.transport + result.cost_breakdown.holding
        pending = [t for t in transfer_orders if t.status == "PENDING_APPROVAL"]

        if context.scenario:
            prompt = (
                f"Explain this rebalancing decision to a supply chain executive in 2-3 sentences. "
                f"Be concise and focus on the business impact:\n"
                f"- Scenario: {context.scenario.name}\n"
                f"- Executive concern: {context.scenario.executive_concern}\n"
                f"- Transfers: {', '.join(f'{t.origin}→{t.destination} ({t.units} units)' for t in transfer_orders)}\n"
                f"- Total cost: ${total_cost:,.0f}\n"
                f"- Hidden logic: {context.scenario.ai_logic}\n"
            )
        else:
            prompt = (
                f"Summarize this rebalancing plan for a supply chain executive in 2-3 sentences:\n"
                f"- {len(transfer_orders)} transfers moving {total_units:,} total units\n"
                f"- Total transport+holding cost: ${total_cost:,.0f}\n"
                f"- {len(pending)} transfers pending approval\n"
            )

        insight = await self.get_llm_insight(prompt)

        if not insight:
            if context.scenario:
                insight = (
                    f"{context.scenario.name}: {context.scenario.ai_logic} "
                    f"Plan moves {total_units:,} units across {len(transfer_orders)} transfers "
                    f"at ${total_cost:,.0f} total cost."
                )
            else:
                insight = (
                    f"Optimizer recommends {len(transfer_orders)} transfers moving "
                    f"{total_units:,} units at ${total_cost:,.0f}. "
                    f"{len(pending)} transfer(s) require manager approval."
                )

        return RebalancingResult(
            optimization_result=result,
            transfer_orders=transfer_orders,
            insight=insight,
        )
