import { Download, ShieldAlert, ShieldCheck, Sigma, Table2 } from 'lucide-react';
import type { AnalyzedDataset, PairwiseTestResult } from '../../types/cosmicwatch';
import { recordsToCsv } from '../../lib/parser';

interface StatisticsAndQualityPanelProps {
  analyzedList: AnalyzedDataset[];
  pairwiseTests: PairwiseTestResult[];
  sipmThresholdMv: number;
}

function formatPValue(p: number): string {
  if (p < 0.001) return '< 0.001';
  return p.toFixed(3);
}

function downloadRawCsv(analyzed: AnalyzedDataset) {
  const csv = recordsToCsv(analyzed.dataset.rawRecords);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = analyzed.dataset.name.endsWith('.csv')
    ? analyzed.dataset.name
    : `${analyzed.dataset.name}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function StatisticsAndQualityPanel({
  analyzedList,
  pairwiseTests,
  sipmThresholdMv,
}: StatisticsAndQualityPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {/* 1. 統計的検定マトリクス */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <Sigma className="h-4 w-4 text-indigo-400" />
              条件間の差の統計的検定（p値）
            </h3>
            <p className="text-xs text-slate-400">
              SiPM 出力分布の差（Mann–Whitney U / KS）および {sipmThresholdMv} mV 超比率検定。赤背景は p &lt; 0.05（5%水準で有意差あり）。
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-3 font-medium">比較ペア</th>
                <th className="px-3 py-2.5 text-right font-medium">Mann–Whitney U</th>
                <th className="px-3 py-2.5 text-right font-medium">KS 検定</th>
                <th className="pl-3 py-2.5 text-right font-medium">比率検定</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {pairwiseTests.map((t) => {
                const sigU = t.mannWhitneyP < 0.05;
                const sigKs = t.ksP < 0.05;
                const sigProp = t.proportionP < 0.05;
                return (
                  <tr key={`${t.idA}-${t.idB}`} className="hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3 font-medium text-slate-200">
                      {t.labelA} <span className="text-slate-500">vs</span> {t.labelB}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span
                        className={`inline-block rounded px-2 py-0.5 ${
                          sigU
                            ? 'bg-rose-500/25 font-bold text-rose-300 ring-1 ring-rose-500/50'
                            : 'text-slate-300'
                        }`}
                      >
                        {formatPValue(t.mannWhitneyP)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      <span
                        className={`inline-block rounded px-2 py-0.5 ${
                          sigKs
                            ? 'bg-rose-500/25 font-bold text-rose-300 ring-1 ring-rose-500/50'
                            : 'text-slate-300'
                        }`}
                      >
                        {formatPValue(t.ksP)}
                      </span>
                    </td>
                    <td className="pl-3 py-2.5 text-right font-mono">
                      <span
                        className={`inline-block rounded px-2 py-0.5 ${
                          sigProp
                            ? 'bg-rose-500/25 font-bold text-rose-300 ring-1 ring-rose-500/50'
                            : 'text-slate-300'
                        }`}
                      >
                        {formatPValue(t.proportionP)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {pairwiseTests.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    2つ以上の条件を選択すると検定結果が表示されます
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. 非破壊データ品質サマリーテーブル */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <Table2 className="h-4 w-4 text-emerald-400" />
              データ品質サマリー（非破壊フィルタリング）
            </h3>
            <p className="text-xs text-slate-400">
              生データは削除せず全件ローカル保持。解析時のみ重複・異常行を除外して計数率を補正します。
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            生データ保護 ON
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-2 font-medium">条件</th>
                <th className="px-2 py-2.5 text-right font-medium">記録行</th>
                <th className="px-2 py-2.5 text-right font-medium">重複</th>
                <th className="px-2 py-2.5 text-right font-medium">破損/温度外</th>
                <th className="px-2 py-2.5 text-right font-medium">有効数</th>
                <th className="px-2 py-2.5 text-right font-medium">推定イベント</th>
                <th className="px-2 py-2.5 text-right font-medium">記録率</th>
                <th className="pl-2 py-2.5 text-right font-medium">生CSV保存</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {analyzedList.map((item) => {
                const m = item.metrics;
                const badCount = m.malformedCount + m.tempOutlierCount;
                return (
                  <tr key={item.dataset.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.dataset.color }}
                        />
                        <div>
                          <div className="font-medium text-slate-100">
                            {item.dataset.conditionLabel}
                          </div>
                          {m.railedA0Count > 0 && (
                            <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-amber-400">
                              <ShieldAlert className="h-3 w-3" />
                              A0=1023 検知 ({m.railedA0Count}件)
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-slate-300">
                      {m.totalRawLines.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-amber-300">
                      {m.duplicateCount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-rose-300">
                      {badCount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono font-semibold text-white">
                      {m.validCount.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-slate-300">
                      {m.estimatedTotalEvents.toLocaleString()}
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono">
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          m.captureRatioPercent >= 85
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {m.captureRatioPercent.toFixed(0)}%
                      </span>
                    </td>
                    <td className="pl-2 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => downloadRawCsv(item)}
                        title="生データを一切削除せずそのままローカルCSVとして保存"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-sky-300 hover:border-sky-500/50 hover:bg-slate-700"
                      >
                        <Download className="h-3 w-3" />
                        保存
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
