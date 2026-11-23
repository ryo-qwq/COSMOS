import { AlertTriangle, BellRing, BrainCircuit, CheckCircle2, Smartphone } from 'lucide-react';
import { evaluateAlertLevel, type MountainTimePoint } from '../../lib/mountainSim';

interface AlertAndPhonePreviewProps {
  stationName: string;
  currentPoint: MountainTimePoint;
}

export function AlertAndPhonePreview({
  stationName,
  currentPoint,
}: AlertAndPhonePreviewProps) {
  const alert = evaluateAlertLevel(currentPoint.aiRiskScore);

  const traditionalJudgment =
    currentPoint.rainfallMmH >= 40
      ? '警戒（豪雨）'
      : currentPoint.rainfallMmH >= 15
        ? '注意（降雨）'
        : '安全（雨なし）';

  const cosmosShortLabel =
    alert.level === 4
      ? '危険・避難'
      : alert.level === 3
        ? '警戒'
        : alert.level === 2
          ? '注意'
          : '平常';

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 危険度判定 AI */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-white">
            <BrainCircuit className="h-5 w-5 text-indigo-400" />
            AI 危険度判定
          </h3>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${alert.badgeClass}`}>
            レベル {alert.level}：{cosmosShortLabel}
          </span>
        </div>

        {/* デカスコア＋ゲージ */}
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-400">危険度スコア</span>
          <span className={`font-mono text-4xl font-extrabold ${alert.colorClass}`}>
            {currentPoint.aiRiskScore}
            <span className="text-base font-normal text-slate-500"> / 100</span>
          </span>
        </div>
        <div className="mt-2 h-3.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${currentPoint.aiRiskScore}%`,
              background:
                alert.level === 4
                  ? 'linear-gradient(90deg, #f97316, #f43f5e)'
                  : alert.level === 3
                    ? 'linear-gradient(90deg, #eab308, #f97316)'
                    : alert.level === 2
                      ? 'linear-gradient(90deg, #38bdf8, #eab308)'
                      : 'linear-gradient(90deg, #10b981, #38bdf8)',
            }}
          />
        </div>

        {/* 従来判断 vs COSMOS（シンプル2列） */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-center">
            <div className="text-xs text-slate-400">従来の判断（降雨）</div>
            <div className="mt-1 text-base font-bold text-slate-200">{traditionalJudgment}</div>
          </div>
          <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-center">
            <div className="text-xs text-sky-300">COSMOS（山体水分）</div>
            <div className={`mt-1 text-base font-bold ${alert.colorClass}`}>{cosmosShortLabel}</div>
          </div>
        </div>
      </div>

      {/* 2. 住民伝達・速報プレビュー */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
          <Smartphone className="h-5 w-5 text-rose-400" />
          住民伝達（Jアラート連携）
        </h3>

        <div
          className={`rounded-2xl border p-4 transition-all ${
            alert.level >= 4
              ? 'border-rose-500 bg-rose-950/50 shadow-lg shadow-rose-500/15'
              : alert.level === 3
                ? 'border-orange-500/70 bg-orange-950/40'
                : 'border-slate-700 bg-slate-950/80'
          }`}
        >
          {alert.level >= 4 ? (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-2.5 py-1 text-xs font-bold text-white">
                <AlertTriangle className="h-4 w-4" />
                【避難指示】土砂災害の危険
              </div>
              <p className="text-base font-bold text-rose-100">
                {stationName}周辺：直ちに避難してください
              </p>
            </div>
          ) : alert.level === 3 ? (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-orange-500 px-2.5 py-1 text-xs font-bold text-slate-950">
                <BellRing className="h-4 w-4" />
                【警戒】高齢者等避難
              </div>
              <p className="text-base font-bold text-orange-100">
                {stationName}周辺：山内部の水分量が高水準
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 py-1">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <span className="text-base font-bold text-emerald-300">警報なし（平常監視中）</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
