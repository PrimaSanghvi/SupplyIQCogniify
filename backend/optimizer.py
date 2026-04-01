import pulp
from models import (
    DistributionCenter, Lane, TransferRecommendation,
    CostBreakdown, DCStateAfter, OptimizationResult,
)


STOCKOUT_PENALTY_PER_UNIT = 100.0
OVERFLOW_PENALTY_PER_UNIT = 3.0
OVERFLOW_ALLOWANCE = 0.15  # allow 15% overflow with penalty


def solve_redeployment(
    dcs: list[DistributionCenter],
    lanes: list[Lane],
    weights: dict,
    budget_ceiling: float = 100000.0,
) -> OptimizationResult:
    w_cost = weights.get("cost", 0.5)
    w_carbon = weights.get("carbon", 0.3)
    w_service = weights.get("service_risk", 0.2)

    dc_map = {dc.id: dc for dc in dcs}
    dc_ids = list(dc_map.keys())

    # Build lane lookup
    lane_map = {}
    for lane in lanes:
        lane_map[(lane.origin, lane.destination)] = lane

    # Decision variables: units to transfer from i to j
    x = {}
    for lane in lanes:
        x[(lane.origin, lane.destination)] = pulp.LpVariable(
            f"x_{lane.origin}_{lane.destination}",
            lowBound=0,
            cat="Integer",
        )

    # Slack variables: unmet demand at each DC
    s = {}
    for dc_id in dc_ids:
        s[dc_id] = pulp.LpVariable(f"slack_{dc_id}", lowBound=0, cat="Continuous")

    # Overflow variables: excess stock above capacity
    overflow = {}
    for dc_id in dc_ids:
        overflow[dc_id] = pulp.LpVariable(f"overflow_{dc_id}", lowBound=0, cat="Continuous")

    prob = pulp.LpProblem("InventoryRedeployment", pulp.LpMinimize)

    # ─── Objective Function ───
    # Cost component: transport + holding
    transport_cost = pulp.lpSum(
        lane_map[(i, j)].transport_cost_per_unit * x[(i, j)]
        for (i, j) in x
    )
    holding_cost = pulp.lpSum(
        dc_map[j].holding_cost_per_unit * x[(i, j)]
        for (i, j) in x
    )

    # Carbon component
    carbon_cost = pulp.lpSum(
        lane_map[(i, j)].carbon_kg_per_unit * x[(i, j)]
        for (i, j) in x
    )

    # Service risk: stockout penalty
    stockout_cost = pulp.lpSum(
        STOCKOUT_PENALTY_PER_UNIT * s[dc_id]
        for dc_id in dc_ids
    )

    # Overflow penalty
    overflow_cost = pulp.lpSum(
        OVERFLOW_PENALTY_PER_UNIT * overflow[dc_id]
        for dc_id in dc_ids
    )

    prob += (
        w_cost * (transport_cost + holding_cost + overflow_cost)
        + w_carbon * carbon_cost
        + w_service * stockout_cost
    )

    # ─── Constraints ───

    for dc_id in dc_ids:
        dc = dc_map[dc_id]

        # Inflow to this DC
        inflow = pulp.lpSum(
            x[(i, dc_id)] for (i, j) in x if j == dc_id
        )
        # Outflow from this DC
        outflow = pulp.lpSum(
            x[(dc_id, j)] for (i, j) in x if i == dc_id
        )

        net_stock = dc.current_stock + inflow - outflow

        # Can't ship more than available stock
        prob += outflow <= dc.current_stock, f"supply_limit_{dc_id}"

        # Unmet demand constraint: s[j] >= demand - net_stock
        prob += s[dc_id] >= dc.demand_forecast - net_stock, f"stockout_{dc_id}"

        # Capacity with overflow: net_stock <= capacity * (1 + allowance)
        max_capacity = int(dc.capacity * (1 + OVERFLOW_ALLOWANCE))
        prob += net_stock <= max_capacity, f"capacity_{dc_id}"

        # Overflow tracking: overflow >= net_stock - capacity
        prob += overflow[dc_id] >= net_stock - dc.capacity, f"overflow_{dc_id}"

    # Budget constraint
    prob += transport_cost <= budget_ceiling, "budget"

    # ─── Solve ───
    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    status = pulp.LpStatus[prob.status]

    # Extract results
    transfers = []
    total_carbon = 0.0
    for (i, j), var in x.items():
        units = int(var.varValue or 0)
        if units > 0:
            lane = lane_map[(i, j)]
            cost = lane.transport_cost_per_unit * units
            carbon = lane.carbon_kg_per_unit * units
            total_carbon += carbon
            transfers.append(TransferRecommendation(
                origin=i, destination=j, units=units,
                cost=round(cost, 2), carbon_kg=round(carbon, 2),
            ))

    # Cost breakdown
    t_cost = sum(t.cost for t in transfers)
    h_cost = sum(
        dc_map[t.destination].holding_cost_per_unit * t.units
        for t in transfers
    )
    s_cost = sum(STOCKOUT_PENALTY_PER_UNIT * (s[dc_id].varValue or 0) for dc_id in dc_ids)
    o_cost = sum(OVERFLOW_PENALTY_PER_UNIT * (overflow[dc_id].varValue or 0) for dc_id in dc_ids)

    cost_breakdown = CostBreakdown(
        transport=round(t_cost, 2),
        holding=round(h_cost, 2),
        stockout_penalty=round(s_cost, 2),
        overflow_penalty=round(o_cost, 2),
    )

    # DC states after optimization
    dc_states = []
    for dc_id in dc_ids:
        dc = dc_map[dc_id]
        inflow_val = sum(
            int(x[(i, dc_id)].varValue or 0) for (i, j) in x if j == dc_id
        )
        outflow_val = sum(
            int(x[(dc_id, j)].varValue or 0) for (i, j) in x if i == dc_id
        )
        stock_after = dc.current_stock + inflow_val - outflow_val
        dc_states.append(DCStateAfter(
            id=dc_id,
            name=dc.name,
            stock_before=dc.current_stock,
            stock_after=stock_after,
            capacity=dc.capacity,
            demand_forecast=dc.demand_forecast,
            utilization_pct=round(stock_after / dc.capacity * 100, 1),
        ))

    # Shadow prices (from constraint duals)
    shadow_prices = {}
    for name, constraint in prob.constraints.items():
        if constraint.pi is not None and abs(constraint.pi) > 0.01:
            shadow_prices[name] = round(constraint.pi, 4)

    return OptimizationResult(
        status=status,
        objective_value=round(pulp.value(prob.objective) or 0, 2),
        transfers=transfers,
        cost_breakdown=cost_breakdown,
        dc_states_after=dc_states,
        shadow_prices=shadow_prices,
        total_carbon_kg=round(total_carbon, 2),
    )


def solve_intuitive(scenario) -> OptimizationResult:
    """Simulate the 'intuitive' (naive) approach for comparison."""
    dc_map = {dc.id: dc for dc in scenario.dcs}
    intuitive = scenario.intuitive_move

    transfers = []
    total_transport = 0.0
    total_holding = 0.0
    total_carbon = 0.0

    # Build lane lookup for the scenario
    lane_map = {}
    for lane in scenario.lanes:
        lane_map[(lane.origin, lane.destination)] = lane

    for t in intuitive.get("transfers", []):
        origin = t["origin"]
        dest = t["destination"]
        units = t["units"]
        lane = lane_map.get((origin, dest))

        if scenario.id == "early_bird" and origin == "DC-ATL" and dest == "DC-CHI":
            # Intuitive waits, so uses the spiked rate
            transport_rate = 10.0
            carbon_rate = 12.0
        elif lane:
            transport_rate = lane.transport_cost_per_unit
            carbon_rate = lane.carbon_kg_per_unit
        else:
            transport_rate = 5.0
            carbon_rate = 20.0

        cost = transport_rate * units
        carbon = carbon_rate * units
        total_transport += cost
        total_holding += dc_map[dest].holding_cost_per_unit * units
        total_carbon += carbon
        transfers.append(TransferRecommendation(
            origin=origin, destination=dest, units=units,
            cost=round(cost, 2), carbon_kg=round(carbon, 2),
        ))

    # Calculate stockout penalties for intuitive approach
    total_stockout = 0.0
    dc_states = []
    for dc in scenario.dcs:
        inflow = sum(t.units for t in transfers if t.destination == dc.id)
        outflow = sum(t.units for t in transfers if t.origin == dc.id)
        stock_after = dc.current_stock + inflow - outflow
        unmet = max(0, dc.demand_forecast - stock_after)
        total_stockout += STOCKOUT_PENALTY_PER_UNIT * unmet
        dc_states.append(DCStateAfter(
            id=dc.id, name=dc.name,
            stock_before=dc.current_stock,
            stock_after=stock_after,
            capacity=dc.capacity,
            demand_forecast=dc.demand_forecast,
            utilization_pct=round(stock_after / dc.capacity * 100, 1),
        ))

    return OptimizationResult(
        status="Intuitive",
        objective_value=round(total_transport + total_holding + total_stockout, 2),
        transfers=transfers,
        cost_breakdown=CostBreakdown(
            transport=round(total_transport, 2),
            holding=round(total_holding, 2),
            stockout_penalty=round(total_stockout, 2),
            overflow_penalty=0.0,
        ),
        dc_states_after=dc_states,
        shadow_prices={},
        total_carbon_kg=round(total_carbon, 2),
    )
