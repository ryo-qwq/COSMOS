import { useState } from 'react';
import { Header, type DashboardMode } from './components/Header';

export function App() {
  const [mode, setMode] = useState<DashboardMode>('experiment');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header mode={mode} onModeChange={setMode} />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {mode === 'experiment' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold text-white">実験用ダッシュボード（構築中）</h2>
            <p className="mt-2 text-sm text-slate-400">
              塩化ビニル管での砂の含水量測定実験の解析・ライブ計測画面をここに実装します。
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold text-white">運用用ダッシュボード（構築中）</h2>
            <p className="mt-2 text-sm text-slate-400">
              名護大北トンネル等の山体内部水分量監視・土砂災害予測画面をここに実装します。
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
