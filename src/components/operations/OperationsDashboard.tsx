import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  CloudRain,
  Droplets,
  MapPin,
  Pause,
  Play,
  ShieldAlert,
} from 'lucide-react';
import {
  evaluateAlertLevel,
  generateMountainSeries,
  MONITORING_STATIONS,
  SCENARIO_PRESETS,
  type ScenarioId,
} from '../../lib/mountainSim';
import { MountainTunnelVisualizer } from './MountainTunnelVisualizer';
import { AlertAndPhonePreview } from './AlertAndPhonePreview';

export function OperationsDashboard() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('post_rain_delayed');
  const [selectedStationId, setSelectedStationId] = useState<string>(MONITORING_STATIONS[0].id);
  const [hourIndex, setHourIndex] = useState<number>(21);
  const [manualRainBoost, setManualRainBoost] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const selectedStation =
    MONITORING_STATIONS.find((s) => s.id === selectedStationId) ?? MONITORING_STATIONS[0];

  const series = useMemo(
    () => generateMountainSeries(scenarioId, selectedStation.moistureOffsetPct, manualRainBoost),
    [scenarioId, selectedStation.moistureOffsetPct, manualRainBoost],
  );

  const currentPoint = series[Math.min(series.length - 1, Math.max(0, hourIndex))];
  const alert = evaluateAlertLevel(currentPoint.aiRiskScore);

  const handleScenarioChange = (id: ScenarioId) => {
    setScenarioId(id);
    setManualRainBoost(0);
    setIsPlaying(false);
    const preset = SCENARIO_PRESETS.find((p) => p.id === id);
    if (preset) setHourIndex(preset.defaultHourIndex);
  };

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setHourIndex((prev) => (prev + 1) % 24);
    }, 900);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  return (
    <div className="space-y-5">
      {/* シナリオ＆時刻コントロール（スリム版） */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex flex-wrap gap-2">
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleScenarioChange(preset.id)}
              className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition-all ${
                scenarioId === preset.id
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {preset.shortLabel}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-4">
          <div className="flex min-w-[220px] items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? '停止' : '再生'}
            </button>
            <input
              type="range"
              min={0}
              max={23}
              value={hourIndex}
              onChange={(e) => {
                setIsPlaying(false);
                setHourIndex(Number(e.target.value));
              }}
              className="w-28 accent-sky-500 sm:w-36"
              aria-label="観測時刻"
            />
            <span className="font-mono text-sm font-bold text-white">{currentPoint.hourLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">追加降雨</span>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={manualRainBoost}
              onChange={(e) => setManualRainBoost(Number(e.target.value))}
              className="w-24 accent-emerald-500"
              aria-label="追加降雨"
            />
            <span className="w-16 font-mono text-xs font-bold text-sky-300">
              +{manualRainBoost} mm
            </span>
          </div>
        </div>
      </div>

      {/* KPI カード 4 枚（デカ文字特化・小文字なし） */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-400">
            <span>山体水分量</span>
            <Droplets className="h-5 w-5 text-sky-400" />
          </div>
          <div className="mt-2 font-mono text-4xl font-extrabold text-sky-300">
            {currentPoint.soilMoisturePct.toFixed(0)}
            <span className="ml-1 text-lg font-semibold text-slate-400">%</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-400">
            <span>ミューオン透過率</span>
            <Activity className="h-5 w-5 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-4xl font-extrabold text-white">
            {currentPoint.muonTransPct}
            <span className="ml-1 text-lg font-semibold text-slate-400">%</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-400">
            <span>現在降雨量</span>
            <CloudRain className="h-5 w-5 text-cyan-400" />
          </div>
          <div className="mt-2 font-mono text-4xl font-extrabold text-white">
            {currentPoint.rainfallMmH.toFixed(0)}
            <span className="ml-1 text-lg font-semibold text-slate-400">mm/h</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-sm font-medium text-slate-400">
            <span>警戒レベル</span>
            <ShieldAlert className={`h-5 w-5 ${alert.colorClass}`} />
          </div>
          <div className={`mt-2 text-3xl font-extrabold ${alert.colorClass}`}>
            レベル {alert.level}
          </div>
        </div>
      </div>

      {/* 中段：山体断面図 + AI判定＆住民速報 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <MountainTunnelVisualizer
            stationName={selectedStation.name}
            rainfallMmH={currentPoint.rainfallMmH}
            soilMoisturePct={currentPoint.soilMoisturePct}
            muonTransPct={currentPoint.muonTransPct}
            muonDropFromDryPct={currentPoint.muonDropFromDryPct}
            alertLevel={alert.level}
          />
        </div>
        <div className="xl:col-span-5">
          <AlertAndPhonePreview
            stationName={selectedStation.name}
            currentPoint={currentPoint}
          />
        </div>
      </div>

      {/* 下段：24時間推移グラフ + 観測拠点切替 */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 xl:col-span-8">
          <h3 className="mb-3 text-base font-bold text-white">
            24時間推移（降雨・山体水分・ミューオン透過）
          </h3>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hourLabel" stroke="#94a3b8" tick={{ fontSize: 12 }} interval={3} />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#38bdf8"
                  domain={[0, 100]}
                  unit="mm"
                  tick={{ fontSize: 12 }}
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
                <ReferenceLine
                  yAxisId="left"
                  x={currentPoint.hourLabel}
                  stroke="#f8fafc"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Bar
                  yAxisId="right"
                  dataKey="rainfallMmH"
                  name="降雨量 (mm/h)"
                  fill="#0284c7"
                  fillOpacity={0.45}
                  radius={[3, 3, 0, 0]}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="soilMoisturePct"
                  name="山体水分量 (%)"
                  stroke="#38bdf8"
                  fill="#38bdf8"
                  fillOpacity={0.18}
                  strokeWidth={2.5}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="muonTransPct"
                  name="ミューオン透過率 (%)"
                  stroke="#fbbf24"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 観測拠点切替（シンプル版） */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 xl:col-span-4">
          <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
            <MapPin className="h-5 w-5 text-emerald-400" />
            観測拠点
          </h3>

          <div className="space-y-2.5">
            {MONITORING_STATIONS.map((st) => {
              const stSeries = generateMountainSeries(
                scenarioId,
                st.moistureOffsetPct,
                manualRainBoost,
              );
              const stNow = stSeries[Math.min(stSeries.length - 1, Math.max(0, hourIndex))];
              const stAlert = evaluateAlertLevel(stNow.aiRiskScore);
              const isSelected = st.id === selectedStation.id;

              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStationId(st.id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/15'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-white">{st.name}</div>
                    <div className="mt-0.5 text-xs text-slate-300">
                      水分 <strong className="text-sky-300">{stNow.soilMoisturePct.toFixed(0)}%</strong> ／ 透過{' '}
                      <strong className="text-amber-300">{stNow.muonTransPct}%</strong>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold ${stAlert.badgeClass}`}
                  >
                    Lv.{stAlert.level}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
