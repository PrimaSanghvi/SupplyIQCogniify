export interface DC {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  current_stock: number;
  demand_forecast: number;
  holding_cost_per_unit: number;
  safety_stock: number;
}

export interface Lane {
  origin: string;
  destination: string;
  distance_miles: number;
  transport_cost_per_unit: number;
  carbon_kg_per_unit: number;
  transit_days: number;
}

export interface NetworkData {
  dcs: DC[];
  lanes: Lane[];
}
