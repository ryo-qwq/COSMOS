export type ScenarioId = 'clear' | 'rain' | 'heavy_rain' | 'post_rain_delayed';

export type AlertLevel = 1 | 2 | 3 | 4;

export interface MountainTimePoint {
  hourLabel: string;
  hourIndex: number;
  rainfallMmH: number;
  soilMoisturePct: number;
  muonTransPct: number; // トンネル外=100% に対する透過率（平常トンネル内は約65%）
  muonDropFromDryPct: number; // 乾燥トンネル内基準に対する追加減衰 [%]
  groundDispMm: number;
  aiRiskScore: number;
}

export interface MonitoringStation {
  id: string;
  name: string;
  area: string;
  overburdenM: number; // 土被り [m]
  lpwaRssiDbm: number;
  batteryPct: number;
  tempC: number;
  moistureOffsetPct: number;
  detectorSpec: string;
}

export interface ScenarioPreset {
  id: ScenarioId;
  title: string;
  shortLabel: string;
  description: string;
  defaultHourIndex: number;
}

export const MONITORING_STATIONS: MonitoringStation[] = [
  {
    id: 'nago-ookita',
    name: '名護大北トンネル',
    area: '名護市大北（主観測点）',
    overburdenM: 65,
    lpwaRssiDbm: -82,
    batteryPct: 94,
    tempC: 23.4,
    moistureOffsetPct: 0,
    detectorSpec: 'CosmicWatch 2段同時計数 (SLAVE)',
  },
  {
    id: 'haneji-tunnel',
    name: '羽地トンネル北口',
    area: '名護市羽地エリア',
    overburdenM: 48,
    lpwaRssiDbm: -88,
    batteryPct: 87,
    tempC: 24.1,
    moistureOffsetPct: -5,
    detectorSpec: 'CosmicWatch 2段同時計数 (SLAVE)',
  },
  {
    id: 'genka-slope',
    name: '源河トンネル山岳部',
    area: 'やんばる北斜面',
    overburdenM: 72,
    lpwaRssiDbm: -93,
    batteryPct: 79,
    tempC: 22.8,
    moistureOffsetPct: 4,
    detectorSpec: 'CosmicWatch 2段同時計数 (SLAVE)',
  },
  {
    id: 'kushidake-south',
    name: '久志岳南側トンネル',
    area: '名護市東海岸側',
    overburdenM: 42,
    lpwaRssiDbm: -85,
    batteryPct: 91,
    tempC: 24.6,
    moistureOffsetPct: -8,
    detectorSpec: 'CosmicWatch 2段同時計数 (SLAVE)',
  },
];

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'clear',
    title: '晴天・平常時',
    shortLabel: '晴天（平常）',
    description: '山体内部は乾燥状態を維持。トンネル内ミューオン透過率は基準値（外比 65%）で安定。',
    defaultHourIndex: 14,
  },
  {
    id: 'rain',
    title: '通常降雨（表面湿潤）',
    shortLabel: '通常降雨',
    description: '15〜25 mm/h の雨が継続。表層の水分量は増えるが深部は安全域で、不要な避難を回避可能。',
    defaultHourIndex: 16,
  },
  {
    id: 'heavy_rain',
    title: '線状降水帯・記録的豪雨',
    shortLabel: '線状降水帯豪雨',
    description: '2024年11月名護豪雨モデル。山体内部水分量が急増し、ミューオン透過率が平常比 -20% 超低下。',
    defaultHourIndex: 19,
  },
  {
    id: 'post_rain_delayed',
    title: '豪雨翌日・遅発性リスク',
    shortLabel: '豪雨翌日（遅発性）',
    description: '雨はほぼ止んだが山内部の水分が滞留。降雨量判断では見落としやすい遅発性土砂崩れを検知。',
    defaultHourIndex: 21,
  },
];

export function evaluateAlertLevel(riskScore: number): {
  level: AlertLevel;
  label: string;
  colorClass: string;
  badgeClass: string;
  actionText: string;
} {
  if (riskScore >= 78) {
    return {
      level: 4,
      label: 'レベル4：危険（避難指示相当）',
      colorClass: 'text-rose-400',
      badgeClass: 'border-rose-500/50 bg-rose-500/20 text-rose-200',
      actionText: '土砂災害警戒区域の住民へ即時避難を伝達（Jアラート・名護市防災無線連携）',
    };
  }
  if (riskScore >= 55) {
    return {
      level: 3,
      label: 'レベル3：警戒（高齢者等避難）',
      colorClass: 'text-orange-400',
      badgeClass: 'border-orange-500/50 bg-orange-500/20 text-orange-200',
      actionText: '名護市防災担当・沖縄気象台へ警戒通知。避難準備・高齢者等の避難開始を推奨',
    };
  }
  if (riskScore >= 32) {
    return {
      level: 2,
      label: 'レベル2：注意（監視強化）',
      colorClass: 'text-amber-300',
      badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
      actionText: '山体内部への浸透を継続監視中。今後の降雨とミューオン減衰推移に注意',
    };
  }
  return {
    level: 1,
    label: 'レベル1：平常（安全）',
    colorClass: 'text-emerald-400',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
    actionText: '山体内部の水分量は安定しています。通常監視を継続中',
  };
}

/**
 * 24時間分の山体監視シミュレーション時系列を生成
 */
export function generateMountainSeries(
  scenario: ScenarioId,
  stationOffsetPct = 0,
  manualRainBoost = 0,
): MountainTimePoint[] {
  const points: MountainTimePoint[] = [];
  let moisture = 24 + stationOffsetPct * 0.4;

  for (let h = 0; h < 24; h++) {
    let rain = 0;
    if (scenario === 'clear') {
      rain = 0;
    } else if (scenario === 'rain') {
      rain = h >= 8 && h <= 18 ? 14 + Math.sin(((h - 8) / 10) * Math.PI) * 12 : 1;
    } else if (scenario === 'heavy_rain') {
      if (h >= 10 && h <= 21) {
        rain = 25 + Math.sin(((h - 10) / 11) * Math.PI) * 68;
      } else {
        rain = 4;
      }
    } else if (scenario === 'post_rain_delayed') {
      // 前半に豪雨があり、後半（15時以降）は雨がほぼ止んでいるのに内部水分が残る
      if (h >= 2 && h <= 12) {
        rain = 32 + Math.sin(((h - 2) / 10) * Math.PI) * 58;
      } else if (h >= 13 && h <= 15) {
        rain = Math.max(2, 18 - (h - 12) * 5);
      } else {
        rain = 1.5;
      }
    }

    rain = Math.max(0, rain + manualRainBoost);

    // 山体内部の保水・排水モデル（排水は遅く、豪雨後も滞留する）
    const infiltration = rain * 0.145;
    const drainage = Math.max(0, (moisture - 22) * 0.042);
    moisture = Math.max(15, Math.min(94, moisture + infiltration - drainage));

    const effectiveMoisture = Math.max(15, Math.min(95, moisture + stationOffsetPct));

    // トンネル内乾燥基準 = 外比 65%（発表資料 p.7: 35%低い）
    // 水分増加に伴いさらに最大 ~26% 減衰（大雨翌日の -20% 減少を再現）
    const moistureExcess = Math.max(0, effectiveMoisture - 24);
    const muonDropFromDryPct = Number(Math.min(28, moistureExcess * 0.36).toFixed(1));
    const muonTransPct = Number((65 * (1 - muonDropFromDryPct / 100)).toFixed(1));

    // 地盤変位 [mm]（水分 65% 超で増加）
    const groundDispMm = Number(
      (0.3 + Math.max(0, effectiveMoisture - 55) * 0.14 + (rain > 50 ? 0.6 : 0)).toFixed(2),
    );

    // 危険度判定 AI スコア（山体内部水分量とミューオン減衰を重視し、降雨量と地盤変位を統合）
    const moistureScore = Math.max(0, (effectiveMoisture - 22) / 68) * 58;
    const muonScore = (muonDropFromDryPct / 24) * 26;
    const rainScore = Math.min(1, rain / 80) * 10;
    const dispScore = Math.min(1, groundDispMm / 6) * 10;
    const aiRiskScore = Math.round(Math.max(4, Math.min(99, moistureScore + muonScore + rainScore + dispScore)));

    points.push({
      hourLabel: `${String(h).padStart(2, '0')}:00`,
      hourIndex: h,
      rainfallMmH: Number(rain.toFixed(1)),
      soilMoisturePct: Number(effectiveMoisture.toFixed(1)),
      muonTransPct,
      muonDropFromDryPct,
      groundDispMm,
      aiRiskScore,
    });
  }

  return points;
}
