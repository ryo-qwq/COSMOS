import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, TrendingDown, Activity } from 'lucide-react';
import type { AnalyzedDataset, HistogramBin } from '../../types/cosmicwatch';

interface ExperimentChartsProps {
  analyzedList: AnalyzedDataset[];
  histogramBins: HistogramBin[];
  sipmThresholdMv: number;
  baselineId: string;
}

export function ExperimentCharts({
  analyzedList,
  histogramBins,
  sipmThresholdMv,
  baselineId,
}: ExperimentChartsProps) {
  const baseline = analyzedList.find((a) => a.dataset.id === baselineId) ?? analyzedList[0];
  const baseTotalRate = baseline?.metrics.totalRatePerMin || 1;
  const baseHighRate = baseline?.metrics.aboveThresholdRatePerMin || 1;

  // 条件別計数率（基準=100%に対する相対割合）
  const relativeRateData = analyzedList.map((item) => ({
    name: item.dataset.conditionLabel,
    allEventsPct: Number(((item.metrics.totalRatePerMin / baseTotalRate) * 100).toFixed(1)),
    highEventsPct: Number(((item.metrics.aboveThresholdRatePerMin / baseHighRate) * 100).toFixed(1)),
    totalRate: Number(item.metrics.totalRatePerMin.toFixed(1)),
    highRate: Number(item.metrics.aboveThresholdRatePerMin.toFixed(2)),
  }));

  // 含水率 vs 減衰率（検量線）
  const calibrationData = analyzedList
    .filter((a) => a.dataset.moisturePercent !== null)
    .sort((a, b) => (a.dataset.moisturePercent ?? 0) - (b.dataset.moisturePercent ?? 0))
    .map((item) => ({
      moisture: item.dataset.moisturePercent ?? 0,
      label: `${item.dataset.moisturePercent}%`,
      highEventsPct: Number(((item.metrics.aboveThresholdRatePerMin / baseHighRate) * 100).toFixed(1)),
      meanSipmMv: Number(item.metrics.meanSipmMv.toFixed(1)),
    }));

  // 閾値に最も近いビンラベルを ReferenceLine 用に取得
  let nearestBinLabel = histogramBins[0]?.label ?? '';
  let minDist = Infinity;
  for (const bin of histogramBins) {
    const dist = Math.abs(bin.binCenterMv - sipmThresholdMv);
    if (dist < minDist) {
      minDist = dist;
      nearestBinLabel = bin.label;
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 1. SiPM出力分布ヒストグラム */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <Activity className="h-4 w-4 text-sky-400" />
              SiPM 出力分布（対数スケールビン）
            </h3>
            <p className="text-xs text-slate-400">
              粒子がシンチレータを通過した際の SiPM 出力 [mV] に対するイベント割合 [%]。赤い破線が解析閾値（{sipmThresholdMv} mV）。
            </p>
          </div>
        </div>
        <div className="h-[290px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={histogramBins} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                interval={2}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                unit="%"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {nearestBinLabel && (
                <ReferenceLine
                  x={nearestBinLabel}
                  stroke="#ef4444"
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  label={{
                    value: `閾値 ${sipmThresholdMv} mV`,
                    position: 'top',
                    fill: '#fca5a5',
                    fontSize: 11,
                  }}
                />
              )}
              {analyzedList.map((item) => (
                <Line
                  key={item.dataset.id}
                  type="stepAfter"
                  dataKey={item.dataset.id}
                  name={item.dataset.conditionLabel}
                  stroke={item.dataset.color}
                  strokeWidth={2.2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. 基準に対する計数率比較 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <BarChart3 className="h-4 w-4 text-rose-400" />
            基準（{baseline?.dataset.conditionLabel ?? '砂なし'}）に対する計数率 [%]
          </h3>
          <p className="text-xs text-slate-400">
            全イベント（ノイズ含む）と {sipmThresholdMv} mV 超の高エネルギーイベントを比較
          </p>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={relativeRateData} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" domain={[60, 115]} unit="%" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine y={100} stroke="#cbd5e1" strokeDasharray="3 3" />
              <Bar dataKey="allEventsPct" name="全イベント (%)" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="highEventsPct"
                name={`${sipmThresholdMv} mV超イベント (%)`}
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. 含水率 vs ミューオン減衰率（検量線） */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <TrendingDown className="h-4 w-4 text-cyan-400" />
            含水率と {sipmThresholdMv} mV 超計数率の関係（検量線）
          </h3>
          <p className="text-xs text-slate-400">
            段階的な含水率（0% → 10% → 20% → 30%）増加に伴うミューオン透過率の低下傾向
          </p>
        </div>
        <div className="h-[260px] w-full">
          {calibrationData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={calibrationData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <YAxis stroke="#94a3b8" domain={[70, 108]} unit="%" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <ReferenceLine y={100} stroke="#475569" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="highEventsPct"
                  name={`${sipmThresholdMv} mV超 計数率（基準比 %）`}
                  stroke="#22d3ee"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              含水率（%）が設定されたデータセットを追加すると検量線が表示されます
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
