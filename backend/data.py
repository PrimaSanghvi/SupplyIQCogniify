from typing import Optional
from models import DistributionCenter, Lane, Scenario

# ─── Base Network: 6 Distribution Centers ───

BASE_DCS = [
    DistributionCenter(
        id="DC-ATL", name="Atlanta", lat=33.749, lng=-84.388,
        capacity=10000, current_stock=8500, demand_forecast=3000,
        holding_cost_per_unit=1.20, safety_stock=500
    ),
    DistributionCenter(
        id="DC-CHI", name="Chicago", lat=41.878, lng=-87.630,
        capacity=10000, current_stock=2200, demand_forecast=6000,
        holding_cost_per_unit=1.50, safety_stock=800
    ),
    DistributionCenter(
        id="DC-LAX", name="Los Angeles", lat=34.052, lng=-118.244,
        capacity=12000, current_stock=7000, demand_forecast=4500,
        holding_cost_per_unit=1.80, safety_stock=600
    ),
    DistributionCenter(
        id="DC-SEA", name="Seattle", lat=47.606, lng=-122.332,
        capacity=8000, current_stock=1500, demand_forecast=4000,
        holding_cost_per_unit=1.40, safety_stock=400
    ),
    DistributionCenter(
        id="DC-DFW", name="Dallas", lat=32.777, lng=-96.797,
        capacity=9000, current_stock=6500, demand_forecast=3500,
        holding_cost_per_unit=1.10, safety_stock=500
    ),
    DistributionCenter(
        id="DC-NYC", name="New York", lat=40.713, lng=-74.006,
        capacity=11000, current_stock=5000, demand_forecast=5500,
        holding_cost_per_unit=2.00, safety_stock=700
    ),
]

# ─── Base Lanes ───

BASE_LANES = [
    Lane(origin="DC-ATL", destination="DC-CHI", distance_miles=720, transport_cost_per_unit=2.50, carbon_kg_per_unit=12.0, transit_days=2, mode="truck"),
    Lane(origin="DC-ATL", destination="DC-NYC", distance_miles=880, transport_cost_per_unit=2.80, carbon_kg_per_unit=14.5, transit_days=2, mode="truck"),
    Lane(origin="DC-ATL", destination="DC-DFW", distance_miles=780, transport_cost_per_unit=2.30, carbon_kg_per_unit=13.0, transit_days=2, mode="truck"),
    Lane(origin="DC-ATL", destination="DC-LAX", distance_miles=2200, transport_cost_per_unit=5.50, carbon_kg_per_unit=35.0, transit_days=4, mode="intermodal"),
    Lane(origin="DC-ATL", destination="DC-SEA", distance_miles=2600, transport_cost_per_unit=6.20, carbon_kg_per_unit=42.0, transit_days=5, mode="intermodal"),
    Lane(origin="DC-CHI", destination="DC-ATL", distance_miles=720, transport_cost_per_unit=2.50, carbon_kg_per_unit=12.0, transit_days=2, mode="truck"),
    Lane(origin="DC-CHI", destination="DC-NYC", distance_miles=790, transport_cost_per_unit=2.60, carbon_kg_per_unit=13.0, transit_days=2, mode="truck"),
    Lane(origin="DC-CHI", destination="DC-DFW", distance_miles=920, transport_cost_per_unit=2.90, carbon_kg_per_unit=15.0, transit_days=2, mode="truck"),
    Lane(origin="DC-CHI", destination="DC-LAX", distance_miles=2020, transport_cost_per_unit=5.00, carbon_kg_per_unit=32.0, transit_days=4, mode="intermodal"),
    Lane(origin="DC-CHI", destination="DC-SEA", distance_miles=2060, transport_cost_per_unit=5.10, carbon_kg_per_unit=33.0, transit_days=4, mode="intermodal"),
    Lane(origin="DC-LAX", destination="DC-SEA", distance_miles=1140, transport_cost_per_unit=3.20, carbon_kg_per_unit=18.0, transit_days=2, mode="rail"),
    Lane(origin="DC-LAX", destination="DC-DFW", distance_miles=1440, transport_cost_per_unit=3.80, carbon_kg_per_unit=23.0, transit_days=3, mode="rail"),
    Lane(origin="DC-LAX", destination="DC-ATL", distance_miles=2200, transport_cost_per_unit=5.50, carbon_kg_per_unit=35.0, transit_days=4, mode="intermodal"),
    Lane(origin="DC-LAX", destination="DC-CHI", distance_miles=2020, transport_cost_per_unit=5.00, carbon_kg_per_unit=32.0, transit_days=4, mode="intermodal"),
    Lane(origin="DC-LAX", destination="DC-NYC", distance_miles=2800, transport_cost_per_unit=6.80, carbon_kg_per_unit=45.0, transit_days=5, mode="intermodal"),
    Lane(origin="DC-SEA", destination="DC-LAX", distance_miles=1140, transport_cost_per_unit=3.20, carbon_kg_per_unit=18.0, transit_days=2, mode="rail"),
    Lane(origin="DC-SEA", destination="DC-DFW", distance_miles=2150, transport_cost_per_unit=5.30, carbon_kg_per_unit=34.0, transit_days=4, mode="intermodal"),
    Lane(origin="DC-SEA", destination="DC-CHI", distance_miles=2060, transport_cost_per_unit=5.10, carbon_kg_per_unit=33.0, transit_days=4, mode="intermodal"),
    Lane(origin="DC-SEA", destination="DC-ATL", distance_miles=2600, transport_cost_per_unit=6.20, carbon_kg_per_unit=42.0, transit_days=5, mode="intermodal"),
    Lane(origin="DC-SEA", destination="DC-NYC", distance_miles=2850, transport_cost_per_unit=6.90, carbon_kg_per_unit=46.0, transit_days=5, mode="intermodal"),
    Lane(origin="DC-DFW", destination="DC-ATL", distance_miles=780, transport_cost_per_unit=2.30, carbon_kg_per_unit=13.0, transit_days=2, mode="truck"),
    Lane(origin="DC-DFW", destination="DC-CHI", distance_miles=920, transport_cost_per_unit=2.90, carbon_kg_per_unit=15.0, transit_days=2, mode="truck"),
    Lane(origin="DC-DFW", destination="DC-LAX", distance_miles=1440, transport_cost_per_unit=3.80, carbon_kg_per_unit=23.0, transit_days=3, mode="rail"),
    Lane(origin="DC-DFW", destination="DC-SEA", distance_miles=2150, transport_cost_per_unit=5.30, carbon_kg_per_unit=34.0, transit_days=4, mode="intermodal"),
    Lane(origin="DC-DFW", destination="DC-NYC", distance_miles=1560, transport_cost_per_unit=4.10, carbon_kg_per_unit=25.0, transit_days=3, mode="intermodal"),
    Lane(origin="DC-NYC", destination="DC-ATL", distance_miles=880, transport_cost_per_unit=2.80, carbon_kg_per_unit=14.5, transit_days=2, mode="truck"),
    Lane(origin="DC-NYC", destination="DC-CHI", distance_miles=790, transport_cost_per_unit=2.60, carbon_kg_per_unit=13.0, transit_days=2, mode="truck"),
    Lane(origin="DC-NYC", destination="DC-DFW", distance_miles=1560, transport_cost_per_unit=4.10, carbon_kg_per_unit=25.0, transit_days=3, mode="intermodal"),
    Lane(origin="DC-NYC", destination="DC-LAX", distance_miles=2800, transport_cost_per_unit=6.80, carbon_kg_per_unit=45.0, transit_days=5, mode="intermodal"),
    Lane(origin="DC-NYC", destination="DC-SEA", distance_miles=2850, transport_cost_per_unit=6.90, carbon_kg_per_unit=46.0, transit_days=5, mode="intermodal"),
]

# ─── Counter-Intuitive Scenarios ───

SCENARIOS = [
    Scenario(
        id="early_bird",
        name="The Early Bird",
        description="Move inventory 2 days before a predicted shortage. Freight rates on the ATL→CHI lane are about to spike 4x due to a regional labor strike, making it far cheaper to ship now.",
        icon="clock",
        executive_concern="Why are we shipping early when we don't need the stock yet?",
        ai_logic="Freight rates on the Atlanta-Chicago lane will surge from $2.50 to $10.00/unit in 2 days due to a regional labor action. Shipping 2,000 units now costs $5,000 vs. $20,000 if we wait. The $1,800 in extra holding cost at Chicago is dwarfed by the $15,000 transport savings.",
        intuitive_move={
            "description": "Wait for demand to materialize, then ship at normal rates",
            "transfers": [{"origin": "DC-ATL", "destination": "DC-CHI", "units": 2000}],
            "estimated_cost": 23800,
        },
        dcs=[
            DistributionCenter(id="DC-ATL", name="Atlanta", lat=33.749, lng=-84.388, capacity=10000, current_stock=8500, demand_forecast=3000, holding_cost_per_unit=1.20, safety_stock=500),
            DistributionCenter(id="DC-CHI", name="Chicago", lat=41.878, lng=-87.630, capacity=10000, current_stock=2200, demand_forecast=6000, holding_cost_per_unit=1.50, safety_stock=800),
            DistributionCenter(id="DC-LAX", name="Los Angeles", lat=34.052, lng=-118.244, capacity=12000, current_stock=7000, demand_forecast=4500, holding_cost_per_unit=1.80, safety_stock=600),
            DistributionCenter(id="DC-SEA", name="Seattle", lat=47.606, lng=-122.332, capacity=8000, current_stock=1500, demand_forecast=4000, holding_cost_per_unit=1.40, safety_stock=400),
            DistributionCenter(id="DC-DFW", name="Dallas", lat=32.777, lng=-96.797, capacity=9000, current_stock=6500, demand_forecast=3500, holding_cost_per_unit=1.10, safety_stock=500),
            DistributionCenter(id="DC-NYC", name="New York", lat=40.713, lng=-74.006, capacity=11000, current_stock=5000, demand_forecast=5500, holding_cost_per_unit=2.00, safety_stock=700),
        ],
        lanes=[
            # ATL->CHI lane at CURRENT (low) rate — the optimizer will use this
            Lane(origin="DC-ATL", destination="DC-CHI", distance_miles=720, transport_cost_per_unit=2.50, carbon_kg_per_unit=12.0, transit_days=2, mode="truck"),
            Lane(origin="DC-ATL", destination="DC-NYC", distance_miles=880, transport_cost_per_unit=2.80, carbon_kg_per_unit=14.5, transit_days=2, mode="truck"),
            Lane(origin="DC-ATL", destination="DC-DFW", distance_miles=780, transport_cost_per_unit=2.30, carbon_kg_per_unit=13.0, transit_days=2, mode="truck"),
            Lane(origin="DC-DFW", destination="DC-CHI", distance_miles=920, transport_cost_per_unit=2.90, carbon_kg_per_unit=15.0, transit_days=2, mode="truck"),
            Lane(origin="DC-NYC", destination="DC-CHI", distance_miles=790, transport_cost_per_unit=2.60, carbon_kg_per_unit=13.0, transit_days=2, mode="truck"),
            Lane(origin="DC-LAX", destination="DC-SEA", distance_miles=1140, transport_cost_per_unit=3.20, carbon_kg_per_unit=18.0, transit_days=2, mode="rail"),
            Lane(origin="DC-DFW", destination="DC-SEA", distance_miles=2150, transport_cost_per_unit=5.30, carbon_kg_per_unit=34.0, transit_days=4, mode="intermodal"),
        ],
    ),
    Scenario(
        id="long_haul",
        name="The Long Haul",
        description="Ship from Dallas (2,150 mi) instead of Los Angeles (1,140 mi) to fulfill Seattle's shortage. The closer DC's stock is reserved for a high-priority customer order.",
        icon="truck",
        executive_concern="Why ship from 2,000 miles away when LA is right there?",
        ai_logic="Los Angeles has 7,000 units but 4,500 are committed to demand and 2,000 are reserved for a Tier-1 customer order arriving tomorrow. Pulling from LAX would cause a $50,000 revenue loss. Dallas has 3,000 surplus units with no competing commitments. The extra $2.10/unit freight ($4,200 total) saves $50,000 in lost revenue.",
        intuitive_move={
            "description": "Ship from nearest DC (Los Angeles) to Seattle",
            "transfers": [{"origin": "DC-LAX", "destination": "DC-SEA", "units": 2000}],
            "estimated_cost": 6400,
        },
        dcs=[
            DistributionCenter(id="DC-ATL", name="Atlanta", lat=33.749, lng=-84.388, capacity=10000, current_stock=5000, demand_forecast=4800, holding_cost_per_unit=1.20, safety_stock=500),
            DistributionCenter(id="DC-CHI", name="Chicago", lat=41.878, lng=-87.630, capacity=10000, current_stock=4500, demand_forecast=4200, holding_cost_per_unit=1.50, safety_stock=800),
            # LAX stock is fully committed: 7000 stock, 7000 demand (incl. reserved Tier-1 order)
            DistributionCenter(id="DC-LAX", name="Los Angeles", lat=34.052, lng=-118.244, capacity=12000, current_stock=7000, demand_forecast=7000, holding_cost_per_unit=1.80, safety_stock=600),
            DistributionCenter(id="DC-SEA", name="Seattle", lat=47.606, lng=-122.332, capacity=8000, current_stock=1500, demand_forecast=4000, holding_cost_per_unit=1.40, safety_stock=400),
            # DFW has surplus
            DistributionCenter(id="DC-DFW", name="Dallas", lat=32.777, lng=-96.797, capacity=9000, current_stock=6500, demand_forecast=3500, holding_cost_per_unit=1.10, safety_stock=500),
            DistributionCenter(id="DC-NYC", name="New York", lat=40.713, lng=-74.006, capacity=11000, current_stock=5000, demand_forecast=5500, holding_cost_per_unit=2.00, safety_stock=700),
        ],
        lanes=[
            Lane(origin="DC-LAX", destination="DC-SEA", distance_miles=1140, transport_cost_per_unit=3.20, carbon_kg_per_unit=18.0, transit_days=2, mode="rail"),
            Lane(origin="DC-DFW", destination="DC-SEA", distance_miles=2150, transport_cost_per_unit=5.30, carbon_kg_per_unit=34.0, transit_days=4, mode="intermodal"),
            Lane(origin="DC-ATL", destination="DC-SEA", distance_miles=2600, transport_cost_per_unit=6.20, carbon_kg_per_unit=42.0, transit_days=5, mode="intermodal"),
            Lane(origin="DC-DFW", destination="DC-CHI", distance_miles=920, transport_cost_per_unit=2.90, carbon_kg_per_unit=15.0, transit_days=2, mode="truck"),
            Lane(origin="DC-ATL", destination="DC-CHI", distance_miles=720, transport_cost_per_unit=2.50, carbon_kg_per_unit=12.0, transit_days=2, mode="truck"),
            Lane(origin="DC-ATL", destination="DC-NYC", distance_miles=880, transport_cost_per_unit=2.80, carbon_kg_per_unit=14.5, transit_days=2, mode="truck"),
            Lane(origin="DC-NYC", destination="DC-SEA", distance_miles=2850, transport_cost_per_unit=6.90, carbon_kg_per_unit=46.0, transit_days=5, mode="intermodal"),
        ],
    ),
    Scenario(
        id="overstock",
        name="The Overstock",
        description="Intentionally push Chicago to 105% capacity ahead of a massive regional promotion. The overflow storage penalty is far less than lost sales from a stockout during peak demand.",
        icon="package",
        executive_concern="Chicago is already at 92% capacity — why send more stock there?",
        ai_logic="A regional promotion starts in 5 days projecting 4,000 extra units of demand at Chicago-area stores. Current stock (9,200) can't cover it. Overflow storage costs $3/unit/day for 500 units = $7,500. But a stockout during the promo means $45,000 in lost sales and brand damage. Net savings: $37,500.",
        intuitive_move={
            "description": "Don't send more stock to a nearly-full DC; redistribute demand to other DCs",
            "transfers": [],
            "estimated_cost": 45000,  # lost sales cost
        },
        dcs=[
            DistributionCenter(id="DC-ATL", name="Atlanta", lat=33.749, lng=-84.388, capacity=10000, current_stock=7500, demand_forecast=3000, holding_cost_per_unit=1.20, safety_stock=500),
            # CHI already at 92% — promo demand spike incoming
            DistributionCenter(id="DC-CHI", name="Chicago", lat=41.878, lng=-87.630, capacity=10000, current_stock=9200, demand_forecast=13000, holding_cost_per_unit=1.50, safety_stock=800),
            DistributionCenter(id="DC-LAX", name="Los Angeles", lat=34.052, lng=-118.244, capacity=12000, current_stock=7000, demand_forecast=4500, holding_cost_per_unit=1.80, safety_stock=600),
            DistributionCenter(id="DC-SEA", name="Seattle", lat=47.606, lng=-122.332, capacity=8000, current_stock=4000, demand_forecast=3500, holding_cost_per_unit=1.40, safety_stock=400),
            DistributionCenter(id="DC-DFW", name="Dallas", lat=32.777, lng=-96.797, capacity=9000, current_stock=6500, demand_forecast=3500, holding_cost_per_unit=1.10, safety_stock=500),
            DistributionCenter(id="DC-NYC", name="New York", lat=40.713, lng=-74.006, capacity=11000, current_stock=5500, demand_forecast=5000, holding_cost_per_unit=2.00, safety_stock=700),
        ],
        lanes=[
            Lane(origin="DC-ATL", destination="DC-CHI", distance_miles=720, transport_cost_per_unit=2.50, carbon_kg_per_unit=12.0, transit_days=2, mode="truck"),
            Lane(origin="DC-DFW", destination="DC-CHI", distance_miles=920, transport_cost_per_unit=2.90, carbon_kg_per_unit=15.0, transit_days=2, mode="truck"),
            Lane(origin="DC-NYC", destination="DC-CHI", distance_miles=790, transport_cost_per_unit=2.60, carbon_kg_per_unit=13.0, transit_days=2, mode="truck"),
            Lane(origin="DC-LAX", destination="DC-CHI", distance_miles=2020, transport_cost_per_unit=5.00, carbon_kg_per_unit=32.0, transit_days=4, mode="intermodal"),
            Lane(origin="DC-ATL", destination="DC-DFW", distance_miles=780, transport_cost_per_unit=2.30, carbon_kg_per_unit=13.0, transit_days=2, mode="truck"),
            Lane(origin="DC-LAX", destination="DC-SEA", distance_miles=1140, transport_cost_per_unit=3.20, carbon_kg_per_unit=18.0, transit_days=2, mode="rail"),
            Lane(origin="DC-ATL", destination="DC-NYC", distance_miles=880, transport_cost_per_unit=2.80, carbon_kg_per_unit=14.5, transit_days=2, mode="truck"),
        ],
    ),
]


def get_distribution_centers() -> list[DistributionCenter]:
    return BASE_DCS


def get_lanes() -> list[Lane]:
    return BASE_LANES


def get_scenarios() -> list[Scenario]:
    return SCENARIOS


def get_scenario(scenario_id: str) -> Optional[Scenario]:
    for s in SCENARIOS:
        if s.id == scenario_id:
            return s
    return None
