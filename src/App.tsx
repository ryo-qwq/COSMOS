import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header, type DashboardMode } from './components/Header';
import { ExperimentDashboard } from './components/experiment/ExperimentDashboard';
import { SerialLivePanel } from './components/experiment/SerialLivePanel';
import { createPresetExperiments } from './lib/presetExperiments';
import { loadSavedDatasets, saveDatasetLocally } from './lib/localDb';
import type { DetectorMode, ExperimentDataset, RawEventRecord } from './types/cosmicwatch';

export function App() {
  const [mode, setMode] = useState<DashboardMode>('experiment');
  const initialPresets = useMemo(() => createPresetExperiments(), []);
  const [datasets, setDatasets] = useState<ExperimentDataset[]>(initialPresets);
  const [activeLiveDatasetId, setActiveLiveDatasetId] = useState<string | null>(null);
  const [isSerialLive, setIsSerialLive] = useState(false);

  // IndexedDB への過度な連続書き込みを防ぐためのバッファ ref
  const liveSaveCounterRef = useRef<number>(0);

  // 起動時にローカル保存（IndexedDB）された過去データを自動復元
  useEffect(() => {
    let mounted = true;
    void loadSavedDatasets().then((saved) => {
      if (!mounted || saved.length === 0) return;
      setDatasets((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        const uniqueSaved = saved.filter((d) => !existingIds.has(d.id));
        return [...prev, ...uniqueSaved];
      });
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddDataset = useCallback((ds: ExperimentDataset) => {
    setDatasets((prev) => [...prev, ds]);
    void saveDatasetLocally(ds);
  }, []);

  const handleStartSerialSession = useCallback((ds: ExperimentDataset) => {
    setActiveLiveDatasetId(ds.id);
    setDatasets((prev) => [...prev, ds]);
    void saveDatasetLocally(ds);
  }, []);

  const handleAppendSerialRecord = useCallback(
    (
      datasetId: string,
      record: RawEventRecord,
      detectedMode?: DetectorMode,
      detectorName?: string,
    ) => {
      setDatasets((prev) => {
        const next = prev.map((ds) => {
          if (ds.id !== datasetId) return ds;
          const updated: ExperimentDataset = {
            ...ds,
            detectorMode: detectedMode ?? ds.detectorMode,
            detectorName: detectorName ?? ds.detectorName,
            rawRecords: [...ds.rawRecords, record],
          };
          liveSaveCounterRef.current += 1;
          if (liveSaveCounterRef.current % 5 === 0 || updated.rawRecords.length <= 5) {
            void saveDatasetLocally(updated);
          }
          return updated;
        });
        return next;
      });
    },
    [],
  );

  const handleAppendMalformed = useCallback((datasetId: string, line: string) => {
    setDatasets((prev) =>
      prev.map((ds) => {
        if (ds.id !== datasetId) return ds;
        const updated: ExperimentDataset = {
          ...ds,
          malformedLines: [...ds.malformedLines, line],
        };
        void saveDatasetLocally(updated);
        return updated;
      }),
    );
  }, []);

  const activeLiveDataset = useMemo(
    () => datasets.find((d) => d.id === activeLiveDatasetId) ?? null,
    [datasets, activeLiveDatasetId],
  );

  // 計測停止時に最新状態を確実に IndexedDB へフラッシュ
  const handleLiveStateChange = useCallback(
    (live: boolean) => {
      setIsSerialLive(live);
      if (!live && activeLiveDataset) {
        void saveDatasetLocally(activeLiveDataset);
      }
    },
    [activeLiveDataset],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header mode={mode} onModeChange={setMode} />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {mode === 'experiment' ? (
          <ExperimentDashboard
            datasets={datasets}
            onAddDataset={handleAddDataset}
            isSerialLive={isSerialLive}
            serialPanelSlot={
              <SerialLivePanel
                onStartSession={handleStartSerialSession}
                onAppendRecord={handleAppendSerialRecord}
                onAppendMalformed={handleAppendMalformed}
                onLiveStateChange={handleLiveStateChange}
                activeLiveDataset={activeLiveDataset}
              />
            }
          />
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
