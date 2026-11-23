import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
} from 'recharts';
import {
  Activity,
  BatteryCharging,
  CloudRain,
  Droplets,
  MapPin,
  Pause,
  Play,
  Radio,
  ShieldAlert,
  Sliders,
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
    <div className="space-y-6">
      {/* 発表用シナリオシミュレーターバー */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Sliders className="h-4 w-4 text-emerald-400" />
              運用シナリオシミュレーター（名護市・山岳トンネル常設モデル）
            </h2>
            <p className="text-xs text-slate-400">
              {SCENARIO_PRESETS.find((s) => s.id === scenarioId)?.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCENARIO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleScenarioChange(preset.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                  scenarioId === preset.id
                    ? 'border-emerald-400 bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {preset.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* 時刻シークバー＆手動降雨オーバーライド */}
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-12">
          <div className="flex items-center gap-3 md:col-span-7">
            <button
              type="button"
              onClick={() => setIsPlaying((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? '一時停止' : '24時間再生'}
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>観測時刻シーク</span>
                <span className="font-mono font-bold text-white">{currentPoint.hourLabel}</span>
              </div>
              <input
                type="range"
                min={0}
                max={23}
                value={hourIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setHourIndex(Number(e.target.value));
                }}
                className="mt-1 w-full accent-sky-500"
              />
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>追加降雨シミュレーション（手動上乗せ）</span>
              <span className="font-mono font-bold text-sky-300">+{manualRainBoost} mm/h</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={manualRainBoost}
              onChange={(e) => setManualRainBoost(Number(e.target.value))}
              className="mt-1 w-full accent-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* KPI カード 4 枚 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>山体内部 推定水分量</span>
            <Droplets className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-sky-300">
            {currentPoint.soilMoisturePct.toFixed(1)}
            <span className="ml-1 text-xs font-normal text-slate-400">%</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">飽和警戒ライン: 65% 超</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ミューオン透過率（乾燥比減衰）</span>
            <Activity className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {currentPoint.muonTransPct}%{' '}
            <span className="text-sm font-semibold text-amber-300">
              (-{currentPoint.muonDropFromDryPct}%)
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">トンネル外基準=100% / 乾燥内=65%</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>現在降雨量 / 地盤変位</span>
            <CloudRain className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {currentPoint.rainfallMmH.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">mm/h</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            地盤変位センサ連携値: {currentPoint.groundDispMm} mm
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>AI 警戒レベル</span>
            <ShieldAlert className={`h-4 w-4 ${alert.colorClass}`} />
          </div>
          <div className={`mt-2 text-xl font-bold ${alert.colorClass}`}>
            レベル {alert.level}（スコア {currentPoint.aiRiskScore}）
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-400">{alert.label}</div>
        </div>
      </div>

      {/* 中段：山体断面ビジュアライザー + AI危険度＆スマホ警報プレビュー */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <MountainTunnelVisualizer
            stationName={selectedStation.name}
            overburdenM={selectedStation.overburdenM}
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
            scenarioId={scenarioId}
          />
        </div>
      </div>

      {/* 下段：24時間マルチ指標トレンド + LPWA広域観測拠点モニター */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 xl:col-span-7">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-white">
              24時間推移：降雨量・山体内部水分量・ミューオン透過率の連動
            </h3>
            <p className="text-xs text-slate-400">
              降雨が止んだ後も山体内部の水分量が高く残り、ミューオン透過率が低下し続ける遅延現象を可視化します。
            </p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hourLabel" stroke="#94a3b8" tick={{ fontSize: 11 }} interval={2} />
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
                  name="山体内部水分量 (%)"
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

        {/* LPWA 観測拠点一覧 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 xl:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <MapPin className="h-4 w-4 text-emerald-400" />
                名護・やんばる LPWA 観測ネットワーク
              </h3>
              <p className="text-xs text-slate-400">
                拠点をクリックすると上部の断面図・AI判定を切り替えられます
              </p>
            </div>
          </div>

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
                  className={`w-full rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-500/10'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{st.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {st.area} ／ 土被り {st.overburdenM}m
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stAlert.badgeClass}`}
                    >
                      Lv.{stAlert.level} ({stNow.aiRiskScore})
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span>
                      水分: <strong className="text-sky-300">{stNow.soilMoisturePct.toFixed(0)}%</strong>
                    </span>
                    <span>
                      透過: <strong className="text-amber-300">{stNow.muonTransPct}%</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Radio className="h-3 w-3 text-emerald-400" />
                      LPWA {st.lpwaRssiDbm} dBm
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BatteryCharging className="h-3 w-3 text-emerald-400" />
                      {st.batteryPct}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
