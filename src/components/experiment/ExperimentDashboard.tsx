import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  Database,
  Filter,
  SlidersHorizontal,
  Thermometer,
  Upload,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import type {
  DetectorMode,
  ExperimentDataset,
  FilterSettings,
} from '../../types/cosmicwatch';
import { parseCosmicWatchCsv } from '../../lib/parser';
import {
  analyzeDataset,
  buildSipmHistogram,
  computePairwiseTests,
} from '../../lib/stats';
import { PvcTubeVisualizer } from './PvcTubeVisualizer';
import { ExperimentCharts } from './ExperimentCharts';
import { StatisticsAndQualityPanel } from './StatisticsAndQualityPanel';

const UPLOAD_COLORS = ['#a855f7', '#ec4899', '#10b981', '#eab308', '#f97316', '#14b8a6'];

interface ExperimentDashboardProps {
  datasets: ExperimentDataset[];
  onAddDataset: (dataset: ExperimentDataset) => void;
  serialPanelSlot?: ReactNode;
  isSerialLive?: boolean;
}

export function ExperimentDashboard({
  datasets,
  onAddDataset,
  serialPanelSlot,
  isSerialLive = false,
}: ExperimentDashboardProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    datasets[datasets.length - 1]?.id ?? datasets[0]?.id ?? '',
  );
  const [visibleIds, setVisibleIds] = useState<Record<string, boolean>>({});
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    tempMin: 20,
    tempMax: 30,
    sipmThresholdMv: 50,
    excludeDuplicates: true,
    excludeTempOutliers: true,
  });

  // CSVアップロード用フォーム状態
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadMoisture, setUploadMoisture] = useState<string>('15');
  const [uploadSandDepth, setUploadSandDepth] = useState<string>('45');
  const [uploadSandMass, setUploadSandMass] = useState<string>('16.0');
  const [uploadMode, setUploadMode] = useState<DetectorMode>('MASTER');
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isVisible = (id: string) => visibleIds[id] ?? true;

  const analyzedAll = useMemo(
    () => datasets.map((ds) => analyzeDataset(ds, filterSettings)),
    [datasets, filterSettings],
  );

  const analyzedVisible = useMemo(
    () => analyzedAll.filter((a) => isVisible(a.dataset.id)),
    [analyzedAll, visibleIds],
  );

  const baselineId = useMemo(() => {
    const noSand = analyzedVisible.find((a) => a.dataset.moisturePercent === null);
    return noSand?.dataset.id ?? analyzedVisible[0]?.dataset.id ?? '';
  }, [analyzedVisible]);

  const histogramBins = useMemo(
    () => buildSipmHistogram(analyzedVisible),
    [analyzedVisible],
  );

  const pairwiseTests = useMemo(
    () => computePairwiseTests(analyzedVisible, filterSettings.sipmThresholdMv),
    [analyzedVisible, filterSettings.sipmThresholdMv],
  );

  const activeAnalyzed =
    analyzedAll.find((a) => a.dataset.id === selectedDatasetId) ??
    analyzedVisible[analyzedVisible.length - 1] ??
    analyzedAll[0];

  const baselineAnalyzed = analyzedAll.find((a) => a.dataset.id === baselineId) ?? analyzedAll[0];

  const activeRatioToBase =
    activeAnalyzed &&
    baselineAnalyzed &&
    baselineAnalyzed.metrics.aboveThresholdRatePerMin > 0
      ? (activeAnalyzed.metrics.aboveThresholdRatePerMin /
          baselineAnalyzed.metrics.aboveThresholdRatePerMin) *
        100
      : null;

  const totalValidEvents = analyzedVisible.reduce((acc, a) => acc + a.metrics.validCount, 0);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCosmicWatchCsv(text);

    if (parsed.rawRecords.length === 0) {
      setUploadNotice(`「${file.name}」から有効なイベント行を読み取れませんでした。`);
      e.target.value = '';
      return;
    }

    const moistureVal = uploadMoisture.trim() === '' ? null : Number(uploadMoisture);
    const color = UPLOAD_COLORS[datasets.length % UPLOAD_COLORS.length];
    const newDs: ExperimentDataset = {
      id: `csv-${Date.now()}`,
      name: file.name,
      conditionLabel:
        uploadLabel.trim() ||
        (moistureVal === null ? `実測: ${file.name}` : `実測 含水砂（${moistureVal}%）`),
      moisturePercent: Number.isFinite(moistureVal) ? moistureVal : null,
      sandDepthCm: Number(uploadSandDepth) || 0,
      sandMassKg: Number(uploadSandMass) || 0,
      detectorMode: parsed.detectedMode !== 'UNKNOWN' ? parsed.detectedMode : uploadMode,
      detectorName: parsed.detectorName,
      source: 'csv',
      createdAt: new Date().toISOString(),
      color,
      rawRecords: parsed.rawRecords,
      malformedLines: parsed.malformedLines,
    };

    onAddDataset(newDs);
    setSelectedDatasetId(newDs.id);
    setUploadLabel('');
    setUploadNotice(
      `「${file.name}」を読み込み、生データ ${parsed.rawRecords.length.toLocaleString()} 件をローカル保存しました。`,
    );
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* KPI サマリーバー */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ローカル保持データセット</span>
            <Database className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {datasets.length} <span className="text-xs font-normal text-slate-400">条件（削除不可）</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>解析対象 有効イベント総数</span>
            <Activity className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {totalValidEvents.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400">件</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>選択条件 {filterSettings.sipmThresholdMv} mV 超（基準比）</span>
            <SlidersHorizontal className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">
            {activeRatioToBase !== null ? `${activeRatioToBase.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            対象: {activeAnalyzed?.dataset.conditionLabel ?? '未選択'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>温度安定性（選択条件平均）</span>
            <Thermometer className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {activeAnalyzed ? `${activeAnalyzed.metrics.meanTempC.toFixed(1)} °C` : '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            解析フィルタ範囲: {filterSettings.tempMin}〜{filterSettings.tempMax} °C
          </div>
        </div>
      </div>

      {/* 実機 Web Serial パネル（Phase 4 スロット） */}
      {serialPanelSlot}

      {/* 上段：塩ビ管断面ビジュアライザー + フィルタ＆CSV読み込みコントロール */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-4">
          {activeAnalyzed && (
            <PvcTubeVisualizer
              conditionLabel={activeAnalyzed.dataset.conditionLabel}
              moisturePercent={activeAnalyzed.dataset.moisturePercent}
              sandDepthCm={activeAnalyzed.dataset.sandDepthCm}
              sandMassKg={activeAnalyzed.dataset.sandMassKg}
              detectorMode={activeAnalyzed.dataset.detectorMode}
              aboveThresholdRatioToBase={activeRatioToBase}
              totalRatePerMin={activeAnalyzed.metrics.totalRatePerMin}
              meanTempC={activeAnalyzed.metrics.meanTempC}
              isLive={isSerialLive && activeAnalyzed.dataset.source === 'serial'}
            />
          )}
        </div>

        <div className="flex flex-col gap-5 xl:col-span-8">
          {/* 条件選択＆非破壊解析フィルタ */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <Filter className="h-4 w-4 text-sky-400" />
                比較条件の選択・解析時フィルタ（非破壊）
              </h3>
              <span className="text-[11px] text-slate-400">
                クリックで断面モデル表示切替 ／ チェックでグラフ表示 ON/OFF
              </span>
            </div>

            {/* データセットチップ */}
            <div className="mb-4 flex flex-wrap gap-2">
              {datasets.map((ds) => {
                const selected = ds.id === activeAnalyzed?.dataset.id;
                const checked = isVisible(ds.id);
                return (
                  <div
                    key={ds.id}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                      selected
                        ? 'border-sky-400 bg-sky-500/15 text-white'
                        : 'border-slate-700/80 bg-slate-950/60 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setVisibleIds((prev) => ({ ...prev, [ds.id]: e.target.checked }))
                      }
                      className="h-3.5 w-3.5 accent-sky-500"
                      aria-label={`${ds.conditionLabel} をグラフに表示`}
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedDatasetId(ds.id)}
                      className="flex items-center gap-1.5 font-medium"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: ds.color }}
                      />
                      <span>{ds.conditionLabel}</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {ds.source === 'preset' ? 'プリセット' : ds.source === 'serial' ? '実機LIVE' : 'CSV'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* スライダー＆フィルタ設定 */}
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">SiPM 高エネルギー閾値</span>
                  <span className="font-mono font-bold text-rose-300">
                    {filterSettings.sipmThresholdMv} mV
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={150}
                  step={5}
                  value={filterSettings.sipmThresholdMv}
                  onChange={(e) =>
                    setFilterSettings((s) => ({
                      ...s,
                      sipmThresholdMv: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-full accent-rose-500"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>20 mV</span>
                  <span>50 mV（発表基準）</span>
                  <span>150 mV</span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-slate-300">重複行を集計対象から除外（元データは保持）</span>
                  <input
                    type="checkbox"
                    checked={filterSettings.excludeDuplicates}
                    onChange={(e) =>
                      setFilterSettings((s) => ({ ...s, excludeDuplicates: e.target.checked }))
                    }
                    className="h-4 w-4 accent-sky-500"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-slate-300">
                    温度異常行（{filterSettings.tempMin}〜{filterSettings.tempMax} °C外）を除外
                  </span>
                  <input
                    type="checkbox"
                    checked={filterSettings.excludeTempOutliers}
                    onChange={(e) =>
                      setFilterSettings((s) => ({ ...s, excludeTempOutliers: e.target.checked }))
                    }
                    className="h-4 w-4 accent-sky-500"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* CosmicWatch CSV アップロード */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Upload className="h-4 w-4 text-emerald-400" />
                  CosmicWatch 実測 CSV の追加読み込み（ローカル自動保存）
                </h3>
                <p className="text-xs text-slate-400">
                  `cosmicwatch_*.csv` や Arduino シリアル出力テキストをそのまま読み込み可能。読み込んだ生データは IndexedDB に永続化されます。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-[11px] text-slate-400">条件ラベル</label>
                <input
                  type="text"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                  placeholder="例: 含水砂（15%）同時計数"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400">含水率 (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={uploadMoisture}
                  onChange={(e) => setUploadMoisture(e.target.value)}
                  placeholder="空=砂なし"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400">砂厚(cm) / 質量(kg)</label>
                <div className="mt-1 flex gap-1">
                  <input
                    type="number"
                    value={uploadSandDepth}
                    onChange={(e) => setUploadSandDepth(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={uploadSandMass}
                    onChange={(e) => setUploadSandMass(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400">検出モード</label>
                <select
                  value={uploadMode}
                  onChange={(e) => setUploadMode(e.target.value as DetectorMode)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="MASTER">単独 (MASTER)</option>
                  <option value="SLAVE">2段同時計数 (SLAVE)</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.log"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400"
              >
                <Upload className="h-3.5 w-3.5" />
                CSV ファイルを選択して追加
              </button>
              {uploadNotice && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {uploadNotice}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 中段：グラフ群 */}
      <ExperimentCharts
        analyzedList={analyzedVisible}
        histogramBins={histogramBins}
        sipmThresholdMv={filterSettings.sipmThresholdMv}
        baselineId={baselineId}
      />

      {/* 下段：統計検定＆非破壊品質サマリー */}
      <StatisticsAndQualityPanel
        analyzedList={analyzedVisible}
        pairwiseTests={pairwiseTests}
        sipmThresholdMv={filterSettings.sipmThresholdMv}
      />
    </div>
  );
}
