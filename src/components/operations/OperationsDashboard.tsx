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
    <div className="space-y-3 sm:space-y-5">
      {/* シナリオ＆時刻コントロール（スマホでも1画面に山の図と同居できるコンパクト設計） */}
      <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:space-y-0 sm:p-4">
        <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleScenarioChange(preset.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm ${
                scenarioId === preset.id
                  ? 'border-emerald-400 bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              {preset.shortLabel}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-1 sm:justify-end sm:gap-4">
          <div className="flex flex-1 items-center gap-2 sm:flex-none sm:gap-3">
            <button
              type="button"
              onClick={() => setIsPlaying((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 sm:rounded-xl sm:px-3.5 sm:py-2"
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
              className="min-w-0 flex-1 accent-sky-500 sm:w-36 sm:flex-none"
              aria-label="観測時刻"
            />
            <span className="shrink-0 font-mono text-xs font-bold text-white sm:text-sm">
              {currentPoint.hourLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] font-medium text-slate-400 sm:text-xs">降雨+</span>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={manualRainBoost}
              onChange={(e) => setManualRainBoost(Number(e.target.value))}
              className="w-16 accent-emerald-500 sm:w-24"
              aria-label="追加降雨"
            />
            <span className="w-11 text-right font-mono text-[11px] font-bold text-sky-300 sm:w-14 sm:text-xs">
              +{manualRainBoost}mm
            </span>
          </div>
        </div>
      </div>

      {/* 山体断面図をスライダー直下に配置（スマホでスライダー操作しながら山が見える！） */}
      <div className="grid grid-cols-1 gap-3 sm:gap-5 xl:grid-cols-12">
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

      {/* KPI カード 4 枚（スマホはコンパクト、PCは大型表示） */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:rounded-2xl sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 sm:text-sm">
            <span>山体水分量</span>
            <Droplets className="h-4 w-4 text-sky-400 sm:h-5 sm:w-5" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-sky-300 sm:mt-2 sm:text-4xl">
            {currentPoint.soilMoisturePct.toFixed(0)}
            <span className="ml-0.5 text-sm font-semibold text-slate-400 sm:ml-1 sm:text-lg">%</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:rounded-2xl sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 sm:text-sm">
            <span>ミューオン透過率</span>
            <Activity className="h-4 w-4 text-amber-400 sm:h-5 sm:w-5" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-white sm:mt-2 sm:text-4xl">
            {currentPoint.muonTransPct}
            <span className="ml-0.5 text-sm font-semibold text-slate-400 sm:ml-1 sm:text-lg">%</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:rounded-2xl sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 sm:text-sm">
            <span>現在降雨量</span>
            <CloudRain className="h-4 w-4 text-cyan-400 sm:h-5 sm:w-5" />
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-white sm:mt-2 sm:text-4xl">
            {currentPoint.rainfallMmH.toFixed(0)}
            <span className="ml-0.5 text-xs font-semibold text-slate-400 sm:ml-1 sm:text-lg">mm/h</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:rounded-2xl sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400 sm:text-sm">
            <span>警戒レベル</span>
            <ShieldAlert className={`h-4 w-4 sm:h-5 sm:w-5 ${alert.colorClass}`} />
          </div>
          <div className={`mt-1 text-2xl font-extrabold sm:mt-2 sm:text-3xl ${alert.colorClass}`}>
            レベル {alert.level}
          </div>
        </div>
      </div>

      {/* 下段：24時間推移グラフ + 観測拠点切替 */}
      <div className="grid grid-cols-1 gap-3 sm:gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 xl:col-span-8">
          <h3 className="mb-3 text-sm font-bold text-white sm:text-base">
            24時間推移（降雨・山体水分・ミューオン透過）
          </h3>
          <div className="h-[220px] w-full sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 10, right: 12, left: -12, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hourLabel" stroke="#94a3b8" tick={{ fontSize: 11 }} interval={3} />
                <YAxis
                  yAxisId="left"
                  stroke="#94a3b8"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#38bdf8"
                  domain={[0, 100]}
                  unit="mm"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '10px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
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

        {/* 観測拠点切替 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 xl:col-span-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white sm:text-base">
            <MapPin className="h-4 w-4 text-emerald-400 sm:h-5 sm:w-5" />
            観測拠点
          </h3>

          <div className="space-y-2">
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
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all ${
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
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${stAlert.badgeClass}`}
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
