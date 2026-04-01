import { Network, GitCompare, Sliders, ArrowRightLeft, Activity, ShieldAlert, MessageCircle } from 'lucide-react';

type Page = 'network' | 'scenarios' | 'optimizer' | 'movements' | 'simulation' | 'risk' | 'chat';

const NAV_ITEMS: { id: Page; label: string; Icon: typeof Network }[] = [
  { id: 'network', label: 'Network', Icon: Network },
  { id: 'scenarios', label: 'Scenarios', Icon: GitCompare },
  { id: 'optimizer', label: 'Optimizer', Icon: Sliders },
  { id: 'movements', label: 'Movements', Icon: ArrowRightLeft },
  { id: 'simulation', label: 'Simulation', Icon: Activity },
  { id: 'risk', label: 'Risk Insights', Icon: ShieldAlert },
  { id: 'chat', label: 'Explainer', Icon: MessageCircle },
];

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <div className="w-56 bg-slate-900 border-r border-slate-700 flex flex-col p-4">
      <div className="mb-8">
        <h1 className="text-lg font-bold text-white leading-tight">Inventory</h1>
        <h1 className="text-lg font-bold text-cyan-400 leading-tight">Redeployment</h1>
        <p className="text-xs text-slate-400 mt-1">Optimization & Explainability</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activePage === id
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
