import { useMemo, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import type { Rebalance } from '../../pages/SimulationPage';

interface DCDayState {
  id: string;
  name: string;
  inventory: number;
  capacity: number;
  dailyDemand: number;
  received: number;
  sent: number;
  resupplied: number;
  status: 'normal' | 'low' | 'healthy' | 'surplus';
  daysOfCoverage: number;
  lat: number;
  lng: number;
}

interface Props {
  dcStates: DCDayState[];
  rebalances: Rebalance[];
  day: number;
}

function statusColor(status: string) {
  if (status === 'surplus') return '#06b6d4';
  if (status === 'healthy') return '#10b981';
  if (status === 'low') return '#f59e0b';
  return '#64748b';
}

function statusGlow(status: string) {
  if (status === 'surplus') return 'rgba(6,182,212,0.3)';
  if (status === 'healthy') return 'rgba(16,185,129,0.3)';
  if (status === 'low') return 'rgba(245,158,11,0.4)';
  return 'rgba(100,116,139,0.2)';
}

function createSimDCIcon(dc: DCDayState) {
  const color = statusColor(dc.status);
  const glow = statusGlow(dc.status);
  const pct = Math.min((dc.inventory / dc.capacity) * 100, 100);
  const label = dc.name.slice(0, 3).toUpperCase();
  const coverageText = dc.daysOfCoverage > 99 ? '99+d' : `${dc.daysOfCoverage.toFixed(0)}d`;

  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;

  return L.divIcon({
    className: '',
    iconSize: [56, 68],
    iconAnchor: [28, 34],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        ${dc.resupplied > 0 ? `<div style="position:absolute;top:-6px;right:0;background:#10b981;color:white;font-size:8px;font-weight:800;padding:1px 4px;border-radius:6px;border:1.5px solid #0f172a;z-index:10;font-family:monospace;">+IN</div>` : ''}
        ${dc.received > 0 ? `<div style="position:absolute;top:-6px;left:0;background:#06b6d4;color:white;font-size:7px;font-weight:800;padding:1px 3px;border-radius:6px;border:1.5px solid #0f172a;z-index:10;font-family:monospace;">+${(dc.received / 1000).toFixed(1)}K</div>` : ''}
        ${dc.sent > 0 ? `<div style="position:absolute;top:8px;right:-4px;background:#f59e0b;color:white;font-size:7px;font-weight:800;padding:1px 3px;border-radius:6px;border:1.5px solid #0f172a;z-index:10;font-family:monospace;">-${(dc.sent / 1000).toFixed(1)}K</div>` : ''}
        <svg width="48" height="48" viewBox="0 0 48 48" style="filter:drop-shadow(0 3px 8px ${glow})">
          <circle cx="24" cy="24" r="${radius}" fill="none" stroke="#334155" stroke-width="3"/>
          <circle cx="24" cy="24" r="${radius}" fill="none" stroke="${color}" stroke-width="3"
            stroke-dasharray="${filled} ${circumference - filled}"
            stroke-dashoffset="${circumference * 0.25}"
            stroke-linecap="round"
            style="transition:stroke-dasharray 0.6s ease"/>
          <circle cx="24" cy="24" r="15" fill="#1e293b" stroke="${color}" stroke-width="1.5"/>
          <text x="24" y="24" text-anchor="middle" dominant-baseline="central"
            font-size="9" font-weight="700" fill="${color}"
            font-family="system-ui,sans-serif">${label}</text>
        </svg>
        <div style="display:flex;gap:3px;margin-top:1px;">
          <div style="background:${color}15;border:1px solid ${color}40;border-radius:6px;padding:0 4px;font-size:7px;font-weight:700;color:${color};font-family:monospace;">${pct.toFixed(0)}%</div>
          <div style="background:#1e293b;border:1px solid #334155;border-radius:6px;padding:0 4px;font-size:7px;font-weight:600;color:#94a3b8;font-family:monospace;">${coverageText}</div>
        </div>
      </div>
    `,
  });
}

function generateArc(start: [number, number], end: [number, number]): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const lat = start[0] + (end[0] - start[0]) * t;
    const lng = start[1] + (end[1] - start[1]) * t;
    const off = Math.sin(Math.PI * t) * 0.08 * Math.abs(end[1] - start[1]);
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    pts.push([lat + nx * off * 0.3, lng + off * 0.15]);
  }
  return pts;
}

function FitBounds({ dcStates }: { dcStates: DCDayState[] }) {
  const map = useMap();
  useEffect(() => {
    if (dcStates.length === 0) return;
    const bounds = L.latLngBounds(dcStates.map((dc) => [dc.lat, dc.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.25), { animate: true, duration: 1 });
  }, [map, dcStates.length]);
  return null;
}

export default function SimulationMap({ dcStates, rebalances, day }: Props) {
  const dcMap = useMemo(() => {
    const m: Record<string, DCDayState> = {};
    dcStates.forEach((dc) => { m[dc.id] = dc; });
    return m;
  }, [dcStates]);

  const arcs = useMemo(() => {
    return rebalances.map((r) => {
      const from = dcMap[r.from];
      const to = dcMap[r.to];
      if (!from || !to) return null;
      return {
        rebalance: r,
        path: generateArc([from.lat, from.lng], [to.lat, to.lng]),
      };
    }).filter(Boolean) as { rebalance: Rebalance; path: [number, number][] }[];
  }, [rebalances, dcMap]);

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700" style={{ height: 450 }}>
      {/* Day overlay */}
      <div className="absolute top-3 left-3 z-[1000] pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 shadow-md flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Day {day} · Live Simulation</span>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700 shadow-md">
          <div className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Status</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2 h-2 rounded-full bg-cyan-500" />Surplus</span>
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500" />Healthy</span>
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-500" />Normal</span>
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-2 h-2 rounded-full bg-amber-500" />Low</span>
          </div>
          <div className="flex gap-x-3 mt-1 pt-1 border-t border-slate-700">
            <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-4 h-[2px] bg-cyan-500 rounded" />Transfer</span>
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-semibold">+IN Resupply</span>
          </div>
        </div>
      </div>

      <MapContainer
        center={[39.0, -98.0]}
        zoom={4}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
        />
        <FitBounds dcStates={dcStates} />

        {/* Glow arcs */}
        {arcs.map(({ path }, idx) => (
          <Polyline
            key={`glow-${day}-${idx}`}
            positions={path}
            pathOptions={{ color: '#06b6d4', weight: 8, opacity: 0.15, lineCap: 'round' }}
          />
        ))}

        {/* Transfer arcs */}
        {arcs.map(({ rebalance, path }, idx) => (
          <Polyline
            key={`route-${day}-${idx}`}
            positions={path}
            pathOptions={{ color: '#06b6d4', weight: 3, opacity: 0.9, dashArray: '8 6', lineCap: 'round', lineJoin: 'round' }}
          >
            <Tooltip sticky>
              <div style={{ fontSize: 11 }}>
                <strong>{rebalance.fromName}</strong> → <strong>{rebalance.toName}</strong><br />
                <span style={{ color: '#06b6d4' }}>{rebalance.units.toLocaleString()} units</span>
                {' · '}
                <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{rebalance.mode}</span>
              </div>
            </Tooltip>
          </Polyline>
        ))}

        {/* DC Markers */}
        {dcStates.map((dc) => (
          <Marker key={`${dc.id}-${day}`} position={[dc.lat, dc.lng]} icon={createSimDCIcon(dc)}>
            <Tooltip direction="top" offset={[0, -35]}>
              <div style={{ padding: '2px 0', minWidth: 150, fontSize: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{dc.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', color: '#334155' }}>
                  <span style={{ color: '#94a3b8' }}>Inventory:</span><span>{dc.inventory.toLocaleString()}</span>
                  <span style={{ color: '#94a3b8' }}>Demand:</span><span>-{dc.dailyDemand.toLocaleString()}</span>
                  {dc.resupplied > 0 && <><span style={{ color: '#10b981' }}>Resupply:</span><span style={{ color: '#10b981', fontWeight: 600 }}>+{dc.resupplied.toLocaleString()}</span></>}
                  {dc.received > 0 && <><span style={{ color: '#06b6d4' }}>Received:</span><span style={{ color: '#06b6d4', fontWeight: 600 }}>+{dc.received.toLocaleString()}</span></>}
                  {dc.sent > 0 && <><span style={{ color: '#f59e0b' }}>Sent:</span><span style={{ color: '#f59e0b', fontWeight: 600 }}>-{dc.sent.toLocaleString()}</span></>}
                  <span style={{ color: '#94a3b8' }}>Coverage:</span><span style={{ fontWeight: 700, color: statusColor(dc.status) }}>{dc.daysOfCoverage > 99 ? '99+' : dc.daysOfCoverage.toFixed(1)} days</span>
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
