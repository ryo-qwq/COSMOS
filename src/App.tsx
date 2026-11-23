import { useMemo, useState } from 'react';
import { Header, type DashboardMode } from './components/Header';
import { ExperimentDashboard } from './components/experiment/ExperimentDashboard';
import { createPresetExperiments } from './lib/presetExperiments';
import type { ExperimentDataset } from './types/cosmicwatch';

export function App() {
  const [mode, setMode] = useState<DashboardMode>('experiment');
  const initialPresets = useMemo(() => createPresetExperiments(), []);
  const [datasets, setDatasets] = useState<ExperimentDataset[]>(initialPresets);

  const handleAddDataset = (ds: ExperimentDataset) => {
    setDatasets((prev) => [...prev, ds]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header mode={mode} onModeChange={setMode} />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {mode === 'experiment' ? (
          <ExperimentDashboard datasets={datasets} onAddDataset={handleAddDataset} />
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold text-white">運用用ダッシュボード（Phase 5 で実装予定）</h2>
            <p className="mt-2 text-sm text-slate-400">
              名護大北トンネル等の山体内部水分量監視・土砂災害予測画面を実装します。
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
