import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import type { DC } from '../../types/network';

interface Props {
  dcs: DC[];
}

export default function ImbalanceBar({ dcs }: Props) {
  const data = dcs.map((dc) => ({
    name: dc.name,
    surplus: dc.current_stock - dc.demand_forecast,
    stock: dc.current_stock,
    demand: dc.demand_forecast,
  }));

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
            formatter={(value: number) => [`${value.toLocaleString()} units`, 'Surplus/Shortage']}
          />
          <ReferenceLine y={0} stroke="#475569" />
          <Bar dataKey="surplus" radius={[4, 4, 0, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.surplus > 0 ? '#22c55e' : '#ef4444'}
                opacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
