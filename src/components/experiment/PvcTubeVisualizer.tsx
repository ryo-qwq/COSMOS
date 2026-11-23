import { useEffect, useState } from 'react';
import { Layers, Play, Pause, Radio } from 'lucide-react';
import type { DetectorMode } from '../../types/cosmicwatch';

interface PvcTubeVisualizerProps {
  conditionLabel: string;
  moisturePercent: number | null;
  sandDepthCm: number;
  sandMassKg: number;
  detectorMode: DetectorMode;
  aboveThresholdRatioToBase: number | null; // % (砂なし=100)
  totalRatePerMin: number;
  meanTempC: number;
  isLive?: boolean;
}

interface Particle {
  id: number;
  x: number;
  absorbed: boolean;
  absorbY: number;
  delay: number;
}

export function PvcTubeVisualizer({
  conditionLabel,
  moisturePercent,
  sandDepthCm,
  sandMassKg,
  detectorMode,
  aboveThresholdRatioToBase,
  totalRatePerMin,
  meanTempC,
  isLive = false,
}: PvcTubeVisualizerProps) {
  const [animating, setAnimating] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!animating) return;
    const id = window.setInterval(() => {
      setTick((t) => (t + 1) % 10000);
    }, 1800);
    return () => window.clearInterval(id);
  }, [animating]);

  const hasSand = moisturePercent !== null;
  const moisture = moisturePercent ?? 0;

  // 含水率に応じた砂の色（乾燥: 明るい黄土色 → 30%含水: 濃い湿潤茶色）
  const sandColor = !hasSand
    ? 'transparent'
    : moisture <= 5
      ? '#c8a66b'
      : moisture <= 15
        ? '#9e7c4c'
        : moisture <= 25
          ? '#755734'
          : '#543c23';

  // 透過率（水分が多いほど途中で吸収される粒子を増やす）
  const absorbProb = !hasSand ? 0.05 : 0.12 + (moisture / 30) * 0.48;

  const particles: Particle[] = [0, 1, 2, 3, 4, 5].map((idx) => {
    const pseudo = ((tick * 17 + idx * 31) % 100) / 100;
    const absorbed = pseudo < absorbProb;
    return {
      id: idx,
      x: 82 + idx * 27,
      absorbed,
      absorbY: 115 + ((idx * 23 + tick * 7) % 85),
      delay: idx * 0.25,
    };
  });

  const isCoincidence = detectorMode === 'SLAVE';

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <Layers className="h-4 w-4 text-sky-400" />
            塩ビ管・砂層 断面モデル
          </h3>
          <p className="text-xs text-slate-400">
            選択条件: <span className="font-medium text-sky-300">{conditionLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              <Radio className="h-3 w-3 animate-pulse" />
              LIVE
            </span>
          )}
          <button
            type="button"
            onClick={() => setAnimating((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
          >
            {animating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {animating ? '停止' : '再生'}
          </button>
        </div>
      </div>

      {/* SVG 断面図 */}
      <div className="relative flex justify-center rounded-xl border border-slate-800/90 bg-slate-950/90 p-3">
        <svg viewBox="0 0 300 315" className="h-[290px] w-full max-w-[300px]">
          <defs>
            <linearGradient id="pvcWall" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="muonBeam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* 宇宙線ラベル */}
          <text x="150" y="18" textAnchor="middle" fill="#7dd3fc" fontSize="11" fontWeight="600">
            宇宙線ミューオン（平均約 4 GeV）
          </text>

          {/* 塩ビ管本体 */}
          <rect x="64" y="42" width="12" height="248" rx="3" fill="url(#pvcWall)" />
          <rect x="224" y="42" width="12" height="248" rx="3" fill="url(#pvcWall)" />
          <rect x="64" y="282" width="172" height="10" rx="3" fill="#334155" />

          {/* 塩ビ管内部背景 */}
          <rect x="76" y="46" width="148" height="236" fill="#0f172a" />

          {/* 砂層 */}
          {hasSand && (
            <g>
              <rect
                x="76"
                y="95"
                width="148"
                height="125"
                fill={sandColor}
                style={{ transition: 'fill 450ms ease' }}
              />
              {/* 水分の粒子表現 */}
              {moisture > 0 &&
                Array.from({ length: Math.round(moisture * 1.1) }).map((_, idx) => {
                  const cx = 86 + ((idx * 37) % 128);
                  const cy = 105 + ((idx * 29) % 105);
                  return (
                    <circle
                      key={idx}
                      cx={cx}
                      cy={cy}
                      r={2.1}
                      fill="#38bdf8"
                      opacity={0.45}
                    />
                  );
                })}
              <text
                x="150"
                y="156"
                textAnchor="middle"
                fill="#f8fafc"
                fontSize="12"
                fontWeight="700"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
              >
                砂層（含水率 {moisture}%）
              </text>
              <text
                x="150"
                y="174"
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="10"
              >
                厚さ {sandDepthCm} cm / 質量 {sandMassKg.toFixed(1)} kg
              </text>
            </g>
          )}

          {!hasSand && (
            <text x="150" y="155" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="600">
              空の塩ビ管（砂なし基準）
            </text>
          )}

          {/* ミューオン軌道 */}
          {particles.map((p) => {
            const endY = p.absorbed && hasSand ? p.absorbY : 244;
            return (
              <g key={`${tick}-${p.id}`}>
                <line
                  x1={p.x}
                  y1={28}
                  x2={p.x}
                  y2={endY}
                  stroke={p.absorbed && hasSand ? '#f59e0b' : '#38bdf8'}
                  strokeWidth={p.absorbed && hasSand ? 1.5 : 2}
                  strokeDasharray={p.absorbed && hasSand ? '4 3' : undefined}
                  opacity={animating ? 0.85 : 0.45}
                />
                {p.absorbed && hasSand ? (
                  <g transform={`translate(${p.x}, ${endY})`}>
                    <circle r="5" fill="#fbbf24" opacity="0.85" />
                    <circle r="9" fill="none" stroke="#f59e0b" strokeWidth="1.2" opacity="0.55" />
                  </g>
                ) : (
                  <polygon
                    points={`${p.x - 3.5},${endY - 4} ${p.x + 3.5},${endY - 4} ${p.x},${endY + 3}`}
                    fill="#38bdf8"
                  />
                )}
              </g>
            );
          })}

          {/* 検出器（1段または2段重ね同時計数） */}
          {isCoincidence ? (
            <g>
              <rect x="92" y="224" width="116" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="150" y="240" textAnchor="middle" fill="#e0f2fe" fontSize="10" fontWeight="600">
                検出器 上段 (MASTER)
              </text>
              <rect x="92" y="252" width="116" height="24" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
              <text x="150" y="268" textAnchor="middle" fill="#a7f3d0" fontSize="10" fontWeight="600">
                検出器 下段 (SLAVE同時計数)
              </text>
            </g>
          ) : (
            <g>
              <rect x="92" y="240" width="116" height="36" rx="5" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
              <text x="150" y="256" textAnchor="middle" fill="#e0f2fe" fontSize="11" fontWeight="600">
                CosmicWatch 検出器
              </text>
              <text x="150" y="270" textAnchor="middle" fill="#94a3b8" fontSize="9.5">
                シンチレータ + SiPM ({detectorMode})
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* 検出器ステータス要約 */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="text-[11px] text-slate-400">計数率</div>
          <div className="mt-0.5 text-sm font-bold text-white">
            {totalRatePerMin.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">/min</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="text-[11px] text-slate-400">50mV超(基準比)</div>
          <div className="mt-0.5 text-sm font-bold text-sky-300">
            {aboveThresholdRatioToBase !== null ? `${aboveThresholdRatioToBase.toFixed(1)}%` : '100.0%'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="text-[11px] text-slate-400">平均温度</div>
          <div className="mt-0.5 text-sm font-bold text-emerald-300">
            {meanTempC.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">°C</span>
          </div>
        </div>
      </div>
    </div>
  );
}
