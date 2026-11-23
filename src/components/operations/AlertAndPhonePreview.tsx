import { AlertTriangle, BellRing, BrainCircuit, CheckCircle2, Smartphone } from 'lucide-react';
import { evaluateAlertLevel, type MountainTimePoint, type ScenarioId } from '../../lib/mountainSim';

interface AlertAndPhonePreviewProps {
  stationName: string;
  currentPoint: MountainTimePoint;
  scenarioId: ScenarioId;
}

export function AlertAndPhonePreview({
  stationName,
  currentPoint,
  scenarioId,
}: AlertAndPhonePreviewProps) {
  const alert = evaluateAlertLevel(currentPoint.aiRiskScore);

  // 従来の降雨量判断との対比メッセージ
  const traditionalJudgment =
    currentPoint.rainfallMmH >= 40
      ? '豪雨を検知（警戒対象）'
      : currentPoint.rainfallMmH >= 15
        ? '降雨継続中（注意）'
        : '降雨なし／弱雨（安全と判断されやすい）';

  const isDelayedDanger =
    currentPoint.rainfallMmH < 10 && currentPoint.soilMoisturePct >= 62;

  const aiReason = isDelayedDanger
    ? `降雨は ${currentPoint.rainfallMmH.toFixed(1)} mm/h まで弱まったが、山体内部水分量が ${currentPoint.soilMoisturePct.toFixed(1)}% と高水準を維持（ミューオン透過率が乾燥基準比 -${currentPoint.muonDropFromDryPct}% 低下）。遅発性土砂崩れリスクを検知しています。`
    : currentPoint.aiRiskScore >= 78
      ? `山体内部水分量が飽和域（${currentPoint.soilMoisturePct.toFixed(1)}%）に達し、ミューオン透過率が -${currentPoint.muonDropFromDryPct}% 急減。地盤変位 ${currentPoint.groundDispMm} mm と併せて土砂災害発生の危険性が極めて高い状態です。`
      : currentPoint.aiRiskScore >= 32
        ? `山体内部の水分量（${currentPoint.soilMoisturePct.toFixed(1)}%）が上昇傾向ですが、まだ飽和臨界点には達していません。局地的な過少・過剰避難を防ぐため監視を継続しています。`
        : `ミューオン透過率（${currentPoint.muonTransPct}%）および山体水分量（${currentPoint.soilMoisturePct.toFixed(1)}%）は平常範囲内で安定しています。`;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. 危険度判定 AI パネル */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <BrainCircuit className="h-4 w-4 text-indigo-400" />
            危険度判定 AI（山体水分＋気象統合）
          </h3>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${alert.badgeClass}`}>
            {alert.label}
          </span>
        </div>

        {/* スコアゲージ */}
        <div className="mt-4">
          <div className="flex items-end justify-between">
            <span className="text-xs text-slate-400">AI 土砂災害危険度スコア</span>
            <span className={`font-mono text-3xl font-extrabold ${alert.colorClass}`}>
              {currentPoint.aiRiskScore}
              <span className="text-sm font-normal text-slate-400"> / 100</span>
            </span>
          </div>
          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-800">
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
        </div>

        {/* 従来判断 vs COSMOS 判断の比較 */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-[11px] font-medium text-slate-400">従来の判断（降雨量のみ）</div>
            <div className="mt-1 text-xs font-semibold text-slate-200">{traditionalJudgment}</div>
            {isDelayedDanger && (
              <div className="mt-1 text-[10px] text-amber-400">
                ※山内部の水が把握できず避難解除・遅れのリスク
              </div>
            )}
          </div>
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
            <div className="text-[11px] font-medium text-sky-300">COSMOS による判断</div>
            <div className={`mt-1 text-xs font-bold ${alert.colorClass}`}>{alert.label}</div>
            <div className="mt-1 text-[10px] text-slate-300">
              山内部水分 {currentPoint.soilMoisturePct.toFixed(1)}% を直接把握
            </div>
          </div>
        </div>

        <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-300">
          {aiReason}
        </p>
      </div>

      {/* 2. 住民伝達・Jアラート / スマホ緊急速報プレビュー */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <Smartphone className="h-4 w-4 text-rose-400" />
            住民伝達・Jアラート連携プレビュー
          </h3>
          <span className="text-[11px] text-slate-400">名護市防災・沖縄気象台連携イメージ</span>
        </div>

        <div
          className={`rounded-2xl border p-4 transition-all ${
            alert.level >= 4
              ? 'border-rose-500 bg-rose-950/50 shadow-lg shadow-rose-500/15'
              : alert.level === 3
                ? 'border-orange-500/70 bg-orange-950/40'
                : 'border-slate-700 bg-slate-950/80'
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5 font-semibold">
              {alert.level >= 3 ? (
                <BellRing className="h-3.5 w-3.5 animate-bounce text-rose-400" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              )}
              COSMOS 防災速報（{currentPoint.hourLabel}）
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {scenarioId === 'post_rain_delayed' ? '遅発性監視' : 'リアルタイム'}
            </span>
          </div>

          <div className="mt-3">
            {alert.level >= 4 ? (
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  【緊急速報】土砂災害警戒・直ちに避難
                </div>
                <p className="text-xs font-semibold text-rose-100">
                  {stationName}周辺の山体内部水分量が危険水準（{currentPoint.soilMoisturePct.toFixed(0)}%）に到達しました。
                </p>
                <p className="text-[11px] text-rose-200/90">
                  斜面近くの住民は速やかに最寄りの避難所または安全な2階以上へ避難してください。（配信元: 名護市防災・COSMOS連携）
                </p>
              </div>
            ) : alert.level === 3 ? (
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-slate-950">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  【警戒情報】高齢者等避難・避難準備
                </div>
                <p className="text-xs font-semibold text-orange-100">
                  {stationName}付近の山内部に多量の水分（{currentPoint.soilMoisturePct.toFixed(0)}%）が滞留しています。
                </p>
                <p className="text-[11px] text-orange-200/90">
                  雨が弱まっていても地盤が緩んでいる可能性があります。避難に時間のかかる方は移動を開始してください。
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-emerald-300">
                  現在、緊急警報は発令されていません
                </div>
                <p className="text-[11px] text-slate-400">{alert.actionText}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
