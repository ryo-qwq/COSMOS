import { Activity, FlaskConical, Mountain, ShieldCheck } from 'lucide-react';

export type DashboardMode = 'experiment' | 'operations';

interface HeaderProps {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
}

export function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sm:sticky sm:top-0 sm:z-40">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20 sm:h-9 sm:w-9 sm:rounded-xl">
            <Activity className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-extrabold tracking-wider text-white sm:text-lg">COSMOS</h1>
            <p className="hidden text-[11px] text-slate-400 sm:block">ミューオン土砂災害予測</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <nav
          aria-label="ダッシュボード切替"
          className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-0.5 sm:p-1"
        >
          <button
            type="button"
            onClick={() => onModeChange('experiment')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm ${
              mode === 'experiment'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FlaskConical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sm:hidden">実験用</span>
            <span className="hidden sm:inline">実験用（塩ビ管・砂含水量）</span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('operations')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:gap-2 sm:px-3.5 sm:py-2 sm:text-sm ${
              mode === 'operations'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Mountain className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sm:hidden">運用用</span>
            <span className="hidden sm:inline">運用用（山岳トンネル監視）</span>
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
