import { useEffect, useState } from 'react';
import { CloudRain, Mountain } from 'lucide-react';
import type { AlertLevel } from '../../lib/mountainSim';

interface MountainTunnelVisualizerProps {
  stationName: string;
  rainfallMmH: number;
  soilMoisturePct: number;
  muonTransPct: number;
  muonDropFromDryPct: number;
  alertLevel: AlertLevel;
}

export function MountainTunnelVisualizer({
  stationName,
  rainfallMmH,
  soilMoisturePct,
  muonTransPct,
  muonDropFromDryPct,
  alertLevel,
}: MountainTunnelVisualizerProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => (t + 1) % 1000), 1500);
    return () => window.clearInterval(id);
  }, []);

  const waterOpacity = Math.min(0.85, Math.max(0.08, (soilMoisturePct - 18) / 75));
  const absorbRatio = Math.min(0.82, 0.25 + (muonDropFromDryPct / 28) * 0.55);
  const rainDropsCount = rainfallMmH < 1 ? 0 : Math.min(28, Math.ceil(rainfallMmH / 3));

  const muonRays = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const x = 115 + i * 38;
    const pseudo = ((tick * 19 + i * 29) % 100) / 100;
    const absorbed = pseudo < absorbRatio;
    const stopY = 120 + ((i * 27 + tick * 11) % 90);
    return { i, x, absorbed, stopY };
  });

  const ringStroke =
    alertLevel === 4
      ? '#f43f5e'
      : alertLevel === 3
        ? '#fb923c'
        : alertLevel === 2
          ? '#fbbf24'
          : '#34d399';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-white sm:gap-2 sm:text-lg">
          <Mountain className="h-4 w-4 text-emerald-400 sm:h-5 sm:w-5" />
          {stationName}
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-300 sm:px-3 sm:py-1 sm:text-sm">
          <CloudRain className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {rainfallMmH.toFixed(0)} mm/h
        </span>
      </div>

      {/* SVG 断面図 */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-1.5 sm:p-2">
        <svg viewBox="0 0 520 310" className="h-[205px] w-full sm:h-[310px]">
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={rainfallMmH > 20 ? '#0f172a' : '#0c1930'} />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
            <linearGradient id="mountainSoil" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f6212" />
              <stop offset="16%" stopColor="#654321" />
              <stop offset="100%" stopColor="#291d12" />
            </linearGradient>
            <linearGradient id="waterSaturation" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={waterOpacity} />
              <stop offset="65%" stopColor="#1d4ed8" stopOpacity={waterOpacity * 0.9} />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity={waterOpacity * 0.75} />
            </linearGradient>
            <clipPath id="mountainClip">
              <path d="M 10 290 Q 95 160 190 92 Q 260 45 330 92 Q 425 160 510 290 Z" />
            </clipPath>
          </defs>

          <rect x="0" y="0" width="520" height="310" fill="url(#skyGrad)" />

          {rainfallMmH >= 2 && (
            <g opacity={Math.min(0.95, 0.35 + rainfallMmH / 70)}>
              <ellipse cx="180" cy="34" rx="58" ry="18" fill="#334155" />
              <ellipse cx="255" cy="30" rx="75" ry="22" fill="#475569" />
              <ellipse cx="335" cy="36" rx="60" ry="17" fill="#334155" />
            </g>
          )}

          {Array.from({ length: rainDropsCount }).map((_, idx) => {
            const rx = 70 + ((idx * 41 + tick * 13) % 380);
            const ry = 46 + ((idx * 23 + tick * 17) % 120);
            return (
              <line
                key={`rain-${idx}`}
                x1={rx}
                y1={ry}
                x2={rx - 4}
                y2={ry + 12}
                stroke="#38bdf8"
                strokeWidth="1.3"
                opacity="0.65"
              />
            );
          })}

          <path
            d="M 10 290 Q 95 160 190 92 Q 260 45 330 92 Q 425 160 510 290 Z"
            fill="url(#mountainSoil)"
            stroke="#4d7c0f"
            strokeWidth="2"
          />

          <g clipPath="url(#mountainClip)">
            <rect
              x="10"
              y={Math.max(60, 240 - soilMoisturePct * 1.95)}
              width="500"
              height="240"
              fill="url(#waterSaturation)"
              style={{ transition: 'all 500ms ease' }}
            />
          </g>

          {muonRays.map((ray) => {
            const endY = ray.absorbed ? ray.stopY : 252;
            return (
              <g key={`ray-${tick}-${ray.i}`}>
                <line
                  x1={ray.x}
                  y1={8}
                  x2={ray.x}
                  y2={endY}
                  stroke={ray.absorbed ? '#f59e0b' : '#38bdf8'}
                  strokeWidth={ray.absorbed ? 1.6 : 2.3}
                  strokeDasharray={ray.absorbed ? '4 3' : undefined}
                  opacity="0.9"
                />
                {ray.absorbed ? (
                  <g transform={`translate(${ray.x}, ${endY})`}>
                    <circle r="5" fill="#fbbf24" />
                    <circle r="9" fill="none" stroke="#f59e0b" strokeWidth="1.2" opacity="0.6" />
                  </g>
                ) : (
                  <polygon
                    points={`${ray.x - 4},${endY - 5} ${ray.x + 4},${endY - 5} ${ray.x},${endY + 3}`}
                    fill="#38bdf8"
                  />
                )}
              </g>
            );
          })}

          <rect x="0" y="286" width="520" height="24" fill="#0f172a" />

          {/* トンネル断面 */}
          <path
            d="M 212 286 L 212 246 A 48 44 0 0 1 308 246 L 308 286 Z"
            fill="#020617"
            stroke="#64748b"
            strokeWidth="3"
          />

          {/* 検出器 */}
          <g>
            <rect
              x="234"
              y="250"
              width="52"
              height="14"
              rx="2.5"
              fill="#1e293b"
              stroke={ringStroke}
              strokeWidth="1.8"
            />
            <rect
              x="234"
              y="266"
              width="52"
              height="14"
              rx="2.5"
              fill="#0f172a"
              stroke={ringStroke}
              strokeWidth="1.8"
            />
            <text x="260" y="302" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="700">
              ミューオン検出器
            </text>
          </g>

          {/* 山体水分量（デカ表示） */}
          <g transform="translate(260, 154)">
            <rect x="-86" y="-26" width="172" height="52" rx="10" fill="#020617" fillOpacity="0.82" stroke="#334155" />
            <text x="0" y="-6" textAnchor="middle" fill="#cbd5e1" fontSize="11" fontWeight="600">
              山体水分量
            </text>
            <text x="0" y="18" textAnchor="middle" fill="#38bdf8" fontSize="22" fontWeight="800">
              {soilMoisturePct.toFixed(0)}%
            </text>
          </g>

          {/* 右上：透過率（デカ表示） */}
          <g transform="translate(382, 16)">
            <rect x="0" y="0" width="126" height="46" rx="10" fill="#0f172a" fillOpacity="0.9" stroke="#334155" />
            <text x="63" y="17" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="600">
              ミューオン透過率
            </text>
            <text x="63" y="38" textAnchor="middle" fill="#fbbf24" fontSize="18" fontWeight="800">
              {muonTransPct}%
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}
