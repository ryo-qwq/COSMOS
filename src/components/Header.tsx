import { Activity, FlaskConical, Mountain, ShieldCheck } from 'lucide-react';

export type DashboardMode = 'experiment' | 'operations';

interface HeaderProps {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
}

export function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold tracking-wider text-white">COSMOS</h1>
            <p className="text-[11px] text-slate-400">ミューオン土砂災害予測</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <nav
          aria-label="ダッシュボード切替"
          className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1"
        >
          <button
            type="button"
            onClick={() => onModeChange('experiment')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
              mode === 'experiment'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            <span>実験用（塩ビ管・砂含水量）</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('operations')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
              mode === 'operations'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Mountain className="h-4 w-4" />
            <span>運用用（山岳トンネル監視）</span>
          </button>
        </nav>

        {/* Policy badge */}
        <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300 xl:flex">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>生データ非破壊・ローカル保存対応</span>
        </div>
      </div>
    </header>
  );
}
