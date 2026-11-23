import type { ExperimentDataset, RawEventRecord } from '../types/cosmicwatch';

/**
 * 決定論的な疑似乱数生成器 (Mulberry32)
 * 発表時に毎回安定した再現性のあるプリセット実験データを提供する。
 */
function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PresetSpec {
  id: string;
  name: string;
  conditionLabel: string;
  moisturePercent: number | null;
  sandDepthCm: number;
  sandMassKg: number;
  color: string;
  seed: number;
  durationMin: number;
  baseRatePerMin: number;
  highEnergyScale: number; // 含水率が高いほど高エネルギー領域が減衰する係数
  duplicateInjection: number;
  gapInjection: number;
  tempOutlierInjection: number;
  malformedLines: string[];
  startIso: string;
}

function generateExperimentRecords(spec: PresetSpec): RawEventRecord[] {
  const rng = createRng(spec.seed);
  const startMs = new Date(spec.startIso).getTime();
  const totalEvents = Math.round(spec.durationMin * spec.baseRatePerMin);
  const meanIntervalMs = (60 / spec.baseRatePerMin) * 1000;

  const records: RawEventRecord[] = [];
  let ardnTime = 1200;
  let deadtime = 0;

  // 欠落区間の開始位置（発表資料 p.10 のような欠落現象を乾燥砂等で再現）
  const gapStartEvent = spec.gapInjection > 0 ? Math.floor(totalEvents * 0.42) : -1;
  const gapEndEvent = gapStartEvent + spec.gapInjection;

  for (let ev = 1; ev <= totalEvents; ev++) {
    const u = Math.max(1e-6, rng());
    const dt = Math.round(-Math.log(u) * meanIntervalMs);
    ardnTime += Math.max(12, dt);
    deadtime += 4.0;

    // 欠落区間の場合は PC 側記録をスキップ（Arduino 側の event 番号と時刻は進む）
    if (gapStartEvent > 0 && ev >= gapStartEvent && ev < gapEndEvent) {
      continue;
    }

    // SiPM 出力分布: 2成分の対数正規分布（低エネルギーノイズ/γ線 + 50mV超ミューオン成分）
    const pHigh = 0.255 * spec.highEnergyScale;
    let sipmMv: number;
    if (rng() < pHigh) {
      // 高エネルギー領域（主に 50〜900 mV）
      const z =
        Math.sqrt(-2 * Math.log(Math.max(1e-6, rng()))) * Math.cos(2 * Math.PI * rng());
      sipmMv = Math.exp(Math.log(120 * spec.highEnergyScale) + 0.72 * z);
      sipmMv = Math.max(42, Math.min(1350, sipmMv));
    } else {
      // 低エネルギー領域（主に 16〜48 mV）
      const z =
        Math.sqrt(-2 * Math.log(Math.max(1e-6, rng()))) * Math.cos(2 * Math.PI * rng());
      sipmMv = Math.exp(Math.log(24.5) + 0.30 * z);
      sipmMv = Math.max(15.5, Math.min(65, sipmMv));
    }

    const adc = Math.min(1020, Math.max(45, Math.round(28 + Math.pow(sipmMv, 0.78) * 5.2)));
    const tempC = Number((25.3 + (rng() - 0.5) * 1.1).toFixed(2));
    const pcTime = new Date(startMs + ardnTime).toISOString();

    const rec: RawEventRecord = {
      pc_time: pcTime,
      event: ev,
      ardn_time_ms: ardnTime,
      adc,
      sipm_mV: Number(sipmMv.toFixed(2)),
      deadtime_ms: Number(deadtime.toFixed(1)),
      temp_C: tempC,
    };

    records.push(rec);
  }

  // 重複行を注入（非破壊前処理の検証デモ用）
  if (spec.duplicateInjection > 0 && records.length > 100) {
    const targetRec = records[Math.floor(records.length * 0.35)];
    for (let k = 0; k < spec.duplicateInjection; k++) {
      records.splice(Math.floor(records.length * 0.35) + 1, 0, { ...targetRec });
    }
  }

  // 温度異常行を注入（20〜30°C 外の破損行イメージ）
  for (let k = 0; k < spec.tempOutlierInjection; k++) {
    const idx = Math.min(records.length - 1, Math.floor((k + 1) * (records.length / (spec.tempOutlierInjection + 1))));
    records.splice(idx, 0, {
      ...records[idx],
      event: records[idx].event,
      temp_C: k % 2 === 0 ? 84.9 : -12.4,
    });
  }

  return records;
}

/**
 * 琉球大学実験（2026/09/24）および今後の段階的含水量検証をベースにしたプリセットデータ
 */
export function createPresetExperiments(): ExperimentDataset[] {
  const specs: PresetSpec[] = [
    {
      id: 'preset-no-sand',
      name: 'ryukyu_20260924_no_sand.csv',
      conditionLabel: '砂なし（基準）',
      moisturePercent: null,
      sandDepthCm: 0,
      sandMassKg: 0,
      color: '#94a3b8',
      seed: 101,
      durationMin: 30,
      baseRatePerMin: 53.8,
      highEnergyScale: 1.0,
      duplicateInjection: 3,
      gapInjection: 120,
      tempOutlierInjection: 2,
      malformedLines: ['2026-09-24T11:52:11.004,412,519201,102,24.122026-09-24T11:52:12'],
      startIso: '2026-09-24T11:41:00.000+09:00',
    },
    {
      id: 'preset-dry-sand',
      name: 'ryukyu_20260924_dry_sand_0pct.csv',
      conditionLabel: '乾燥砂（0%）',
      moisturePercent: 0,
      sandDepthCm: 45,
      sandMassKg: 14.2,
      color: '#f59e0b',
      seed: 202,
      durationMin: 35,
      baseRatePerMin: 54.4,
      highEnergyScale: 0.99,
      duplicateInjection: 140,
      gapInjection: 480,
      tempOutlierInjection: 1,
      malformedLines: ['2026-09-24T13:11:04.221,806,991204,CORRUPT_LINE'],
      startIso: '2026-09-24T12:45:00.000+09:00',
    },
    {
      id: 'preset-wet-10',
      name: 'cosmos_stage_wet_10pct.csv',
      conditionLabel: '含水砂（10%）',
      moisturePercent: 10,
      sandDepthCm: 45,
      sandMassKg: 15.6,
      color: '#38bdf8',
      seed: 303,
      durationMin: 30,
      baseRatePerMin: 53.3,
      highEnergyScale: 0.94,
      duplicateInjection: 0,
      gapInjection: 0,
      tempOutlierInjection: 0,
      malformedLines: [],
      startIso: '2026-09-24T13:40:00.000+09:00',
    },
    {
      id: 'preset-wet-20',
      name: 'cosmos_stage_wet_20pct.csv',
      conditionLabel: '含水砂（20%）',
      moisturePercent: 20,
      sandDepthCm: 45,
      sandMassKg: 17.0,
      color: '#6366f1',
      seed: 404,
      durationMin: 30,
      baseRatePerMin: 52.8,
      highEnergyScale: 0.89,
      duplicateInjection: 0,
      gapInjection: 0,
      tempOutlierInjection: 0,
      malformedLines: [],
      startIso: '2026-09-24T14:15:00.000+09:00',
    },
    {
      id: 'preset-wet-30',
      name: 'ryukyu_20260924_wet_30pct.csv',
      conditionLabel: '含水砂（30%）',
      moisturePercent: 30,
      sandDepthCm: 45,
      sandMassKg: 18.5,
      color: '#22d3ee',
      seed: 505,
      durationMin: 28,
      baseRatePerMin: 52.2,
      highEnergyScale: 0.83,
      duplicateInjection: 1,
      gapInjection: 45,
      tempOutlierInjection: 1,
      malformedLines: ['2026-09-24T15:02:18.910,912,BAD_FRAME'],
      startIso: '2026-09-24T14:42:00.000+09:00',
    },
  ];

  return specs.map((spec) => ({
    id: spec.id,
    name: spec.name,
    conditionLabel: spec.conditionLabel,
    moisturePercent: spec.moisturePercent,
    sandDepthCm: spec.sandDepthCm,
    sandMassKg: spec.sandMassKg,
    detectorMode: 'MASTER',
    detectorName: 'detector-A',
    source: 'preset',
    createdAt: spec.startIso,
    color: spec.color,
    rawRecords: generateExperimentRecords(spec),
    malformedLines: spec.malformedLines,
  }));
}
