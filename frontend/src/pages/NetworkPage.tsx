import { useEffect, useState } from 'react';
import { fetchNetwork } from '../api/network';
import type { DC, Lane } from '../types/network';
import NetworkMap, { deriveRisk } from '../components/network/NetworkMap';
import DCDetailsPanel from '../components/network/DCDetailsPanel';
import LaneDirectoryPanel from '../components/network/LaneDirectoryPanel';
import { MapPin, ArrowRight, AlertTriangle, Package, Truck } from 'lucide-react';

export default function NetworkPage() {
  const [dcs, setDcs] = useState<DC[]>([]);
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetwork().then((data) => {
      setDcs(data.dcs);
      setLanes(data.lanes);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-slate-400 p-8">Loading network...</div>;
  }

  const atRiskCount = dcs.filter((dc) => deriveRisk(dc) === 'high').length;
  const totalInventory = dcs.reduce((s, dc) => s + dc.current_stock, 0);

  // Deduplicate lanes for count
  const seenLanes = new Set<string>();
  lanes.forEach((l) => {
    const key = [l.origin, l.destination].sort().join('-');
    seenLanes.add(key);
  });
  const uniqueLaneCount = seenLanes.size;

  const avgTransit = lanes.length > 0
    ? lanes.reduce((s, l) => s + l.transit_days, 0) / lanes.length
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Distribution Network Overview</h2>
        <p className="text-slate-400 text-sm mt-1">
          Geospatial view of all distribution centers and supply chain routes
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <div>
            <p className="text-[10px] uppercase text-slate-400 tracking-wider">Nodes</p>
            <p className="text-sm font-bold text-white">{dcs.length} DCs</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-indigo-400" />
          <div>
            <p className="text-[10px] uppercase text-slate-400 tracking-wider">Lanes</p>
            <p className="text-sm font-bold text-white">{uniqueLaneCount} routes</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <div>
            <p className="text-[10px] uppercase text-slate-400 tracking-wider">At Risk</p>
            <p className="text-sm font-bold text-white">{atRiskCount} DCs</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2">
          <Package className="w-4 h-4 text-green-400" />
          <div>
            <p className="text-[10px] uppercase text-slate-400 tracking-wider">Total Inventory</p>
            <p className="text-sm font-bold text-white">{totalInventory.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2">
          <Truck className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-[10px] uppercase text-slate-400 tracking-wider">Avg Transit</p>
            <p className="text-sm font-bold text-white">{avgTransit.toFixed(1)} days</p>
          </div>
        </div>
      </div>

      {/* Leaflet Map */}
      <NetworkMap dcs={dcs} lanes={lanes} />

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DCDetailsPanel dcs={dcs} />
        <LaneDirectoryPanel lanes={lanes} dcs={dcs} />
      </div>
    </div>
  );
}
