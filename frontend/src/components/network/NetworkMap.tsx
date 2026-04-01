import { useMemo, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import type { DC, Lane } from '../../types/network';

interface Props {
  dcs: DC[];
  lanes: Lane[];
}

// Generate curved arc coordinates between two points
function generateArc(
  start: [number, number],
  end: [number, number],
  numPoints = 50
): [number, number][] {
  const points: [number, number][] = [];
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = lat1 + (lat2 - lat1) * t;
    const lng = lng1 + (lng2 - lng1) * t;
    const offset = Math.sin(Math.PI * t) * 0.08 * Math.abs(lng2 - lng1);
    const dx = lat2 - lat1;
    const dy = lng2 - lng1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    points.push([lat + nx * offset * 0.3, lng + offset * 0.15]);
  }
  return points;
}

// Risk derived from inventory health
export function deriveRisk(dc: DC): 'low' | 'medium' | 'high' {
  const ratio = dc.current_stock / dc.demand_forecast;
  if (ratio < 0.5) return 'high';
  if (ratio < 1.0) return 'medium';
  return 'low';
}

function riskColorHex(level: string) {
  if (level === 'high') return '#ef4444';
  if (level === 'medium') return '#f59e0b';
  return '#10b981';
}

function createDCIcon(dc: DC) {
  const risk = deriveRisk(dc);
  const color = riskColorHex(risk);
  const fill = dc.current_stock / dc.capacity;
  const pct = (fill * 100).toFixed(0);
  const label = dc.name.slice(0, 3).toUpperCase();
  const isHigh = risk === 'high';

  return L.divIcon({
    className: '',
    iconSize: [48, 58],
    iconAnchor: [24, 29],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        ${isHigh ? `<div style="position:absolute;top:-4px;right:2px;width:16px;height:16px;background:#ef4444;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;z-index:10;font-size:10px;font-weight:800;color:white;box-shadow:0 2px 6px rgba(239,68,68,0.5);">!</div>` : ''}
        <div style="
          width:40px;height:40px;border-radius:50%;
          background:white;
          border:2.5px solid ${color};
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 3px 12px rgba(0,0,0,0.15), 0 0 0 3px ${color}20;
          cursor:pointer;
          transition:transform 0.2s;
        ">
          <span style="font-size:10px;font-weight:700;color:#334155;letter-spacing:0.5px;font-family:monospace;">${label}</span>
        </div>
        <div style="
          margin-top:2px;
          background:${color}18;
          border:1px solid ${color}40;
          border-radius:8px;
          padding:1px 6px;
          font-size:8px;
          font-weight:600;
          color:${color};
          font-family:monospace;
        ">${pct}%</div>
      </div>
    `,
  });
}

function FitBounds({ dcs }: { dcs: DC[] }) {
  const map = useMap();
  useEffect(() => {
    if (dcs.length === 0) return;
    const bounds = L.latLngBounds(dcs.map((dc) => [dc.lat, dc.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.25), { animate: true, duration: 1.5 });
  }, [map, dcs]);
  return null;
}

export default function NetworkMap({ dcs, lanes }: Props) {
  const dcMap = useMemo(() => Object.fromEntries(dcs.map((dc) => [dc.id, dc])), [dcs]);

  // Deduplicate lanes and generate arcs
  const arcs = useMemo(() => {
    const seen = new Set<string>();
    return lanes
      .filter((lane) => {
        const key = [lane.origin, lane.destination].sort().join('-');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((lane) => {
        const fromDC = dcMap[lane.origin];
        const toDC = dcMap[lane.destination];
        if (!fromDC || !toDC) return null;
        const path = generateArc([fromDC.lat, fromDC.lng], [toDC.lat, toDC.lng], 60);
        const isAnomalous =
          deriveRisk(fromDC) === 'high' || deriveRisk(toDC) === 'high';
        return { lane, path, isAnomalous };
      })
      .filter(Boolean) as { lane: Lane; path: [number, number][]; isAnomalous: boolean }[];
  }, [lanes, dcMap]);

  const center: [number, number] = [39.5, -98.35];

  return (
    <div
      className="overflow-hidden relative rounded-2xl border border-slate-700 shadow-xl"
      style={{ height: '550px' }}
    >
      {/* Title overlay */}
      <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg border border-slate-200 shadow-md">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Network Topology &middot; Supply Chain Routes
          </h3>
        </div>
      </div>

      {/* Legend overlay */}
      <div className="absolute bottom-5 left-5 z-[1000] pointer-events-none">
        <div className="bg-white/95 backdrop-blur-xl px-4 py-3 rounded-xl border border-slate-200 shadow-lg flex flex-col gap-2.5 min-w-[170px]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
            Route Legend
          </span>
          <div className="flex items-center gap-3">
            <div className="w-7 h-[3px] rounded-full bg-indigo-500" />
            <span className="text-[10px] font-semibold text-slate-600">Primary Route</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-[3px] rounded-full bg-amber-500" style={{ borderBottom: '1px dashed #f59e0b' }} />
            <span className="text-[10px] font-semibold text-slate-600">At-Risk Route</span>
          </div>
          <div className="flex items-center gap-2 mt-1 pt-1.5 border-t border-slate-100">
            <div className="w-3 h-3 rounded-full bg-white border-2 border-emerald-500" />
            <span className="text-[9px] text-slate-400">Low Risk</span>
            <div className="w-3 h-3 rounded-full bg-white border-2 border-amber-500 ml-1" />
            <span className="text-[9px] text-slate-400">Med</span>
            <div className="w-3 h-3 rounded-full bg-white border-2 border-red-500 ml-1" />
            <span className="text-[9px] text-slate-400">High</span>
          </div>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={4}
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ height: '100%', width: '100%', background: '#f8fafc' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <FitBounds dcs={dcs} />

        {/* Route arcs */}
        {arcs.map(({ lane, path, isAnomalous }, idx) => (
          <Polyline
            key={`route-${idx}`}
            positions={path}
            pathOptions={{
              color: isAnomalous ? '#f59e0b' : '#6366f1',
              weight: isAnomalous ? 4 : 3,
              opacity: 0.85,
              dashArray: isAnomalous ? '12 6' : '8 4',
              lineCap: 'round',
              lineJoin: 'round',
            }}
          >
            <Tooltip sticky>
              <div style={{ fontSize: 11 }}>
                <strong>{dcMap[lane.origin]?.name}</strong>
                {' \u2192 '}
                <strong>{dcMap[lane.destination]?.name}</strong>
                <br />
                <span style={{ color: '#6366f1' }}>{lane.distance_miles} mi</span>
                {' \u00b7 '}
                <span style={{ color: '#64748b' }}>${lane.transport_cost_per_unit}/unit</span>
                {' \u00b7 '}
                <span style={{ color: '#64748b' }}>{lane.transit_days}d</span>
                {isAnomalous && (
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}> \u26a1 At-Risk</span>
                )}
              </div>
            </Tooltip>
          </Polyline>
        ))}

        {/* DC Markers */}
        {dcs.map((dc) => (
          <Marker key={dc.id} position={[dc.lat, dc.lng]} icon={createDCIcon(dc)}>
            <Tooltip direction="top" offset={[0, -30]}>
              <div style={{ padding: '2px 0' }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{dc.name}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  Inventory: {dc.current_stock.toLocaleString()} / {dc.capacity.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  Demand Forecast: {dc.demand_forecast.toLocaleString()} units
                </div>
                <div style={{ fontSize: 10, color: riskColorHex(deriveRisk(dc)), fontWeight: 600 }}>
                  Risk: {deriveRisk(dc).toUpperCase()}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
