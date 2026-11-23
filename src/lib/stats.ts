import type {
  AnalyzedDataset,
  DatasetQualityMetrics,
  ExperimentDataset,
  FilterSettings,
  HistogramBin,
  PairwiseTestResult,
  RawEventRecord,
} from '../types/cosmicwatch';

/**
 * 標準正規分布の累積分布関数 Φ(x) の高精度近似 (Abramowitz & Stegun 7.1.26)
 */
function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * absX);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * erf);
}

/**
 * 2標本 Mann–Whitney U 検定（タイ補正付き正規近似、両側 p 値）
 */
export function mannWhitneyU(a: number[], b: number[]): number {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 2 || n2 < 2) return 1;

  const combined: { val: number; group: 0 | 1 }[] = [];
  for (let i = 0; i < n1; i++) combined.push({ val: a[i], group: 0 });
  for (let i = 0; i < n2; i++) combined.push({ val: b[i], group: 1 });
  combined.sort((x, y) => x.val - y.val);

  const n = n1 + n2;
  let r1 = 0;
  let tieCorrectionSum = 0;
  let i = 0;

  while (i < n) {
    let j = i;
    while (j + 1 < n && combined[j + 1].val === combined[i].val) {
      j++;
    }
    const avgRank = (i + j) / 2 + 1;
    const tieCount = j - i + 1;
    if (tieCount > 1) {
      tieCorrectionSum += tieCount * tieCount * tieCount - tieCount;
    }
    for (let k = i; k <= j; k++) {
      if (combined[k].group === 0) r1 += avgRank;
    }
    i = j + 1;
  }

  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;
  const variance = ((n1 * n2) / 12) * (n + 1 - tieCorrectionSum / (n * (n - 1)));
  if (variance <= 0) return 1;

  const z = (Math.abs(u1 - mu) - 0.5) / Math.sqrt(variance);
  const p = 2 * (1 - normalCdf(Math.max(0, z)));
  return Math.max(0, Math.min(1, p));
}

/**
 * 2標本 Kolmogorov–Smirnov (KS) 検定（漸近分布による両側 p 値）
 */
export function kolmogorovSmirnov2Sample(a: number[], b: number[]): number {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 2 || n2 < 2) return 1;

  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);

  let i = 0;
  let j = 0;
  let dMax = 0;

  while (i < n1 && j < n2) {
    if (sa[i] < sb[j]) {
      i++;
    } else if (sb[j] < sa[i]) {
      j++;
    } else {
      const v = sa[i];
      while (i < n1 && sa[i] === v) i++;
      while (j < n2 && sb[j] === v) j++;
    }
    const diff = Math.abs(i / n1 - j / n2);
    if (diff > dMax) dMax = diff;
  }

  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  const lambda = (en + 0.12 + 0.11 / en) * dMax;
  if (lambda <= 0) return 1;

  // Kolmogorov distribution tail sum
  let sum = 0;
  for (let k = 1; k <= 100; k++) {
    const term = Math.exp(-2 * k * k * lambda * lambda);
    sum += (k % 2 === 1 ? 1 : -1) * term;
    if (term < 1e-10) break;
  }
  return Math.max(0, Math.min(1, 2 * sum));
}

/**
 * 2標本比率検定（閾値超イベントの割合の差、両側 z 検定）
 */
export function twoProportionZTest(countA: number, nA: number, countB: number, nB: number): number {
  if (nA < 1 || nB < 1) return 1;
  const p1 = countA / nA;
  const p2 = countB / nB;
  const pPool = (countA + countB) / (nA + nB);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / nA + 1 / nB));
  if (se <= 0) return 1;
  const z = Math.abs(p1 - p2) / se;
  return Math.max(0, Math.min(1, 2 * (1 - normalCdf(z))));
}

/**
 * 生データセットを非破壊でフィルタリングし、品質指標・計数率・統計量を算出する。
 */
export function analyzeDataset(
  dataset: ExperimentDataset,
  settings: FilterSettings,
): AnalyzedDataset {
  const seenKeys = new Set<string>();
  const validRecords: RawEventRecord[] = [];
  let duplicateCount = 0;
  let tempOutlierCount = 0;
  let railedA0Count = 0;

  for (const rec of dataset.rawRecords) {
    if (rec.adc >= 1023) {
      railedA0Count++;
    }

    const dupKey = `${rec.event}:${rec.ardn_time_ms}`;
    const isDuplicate = seenKeys.has(dupKey);
    seenKeys.add(dupKey);

    if (isDuplicate) {
      duplicateCount++;
      if (settings.excludeDuplicates) continue;
    }

    const isTempOutlier = rec.temp_C < settings.tempMin || rec.temp_C > settings.tempMax;
    if (isTempOutlier) {
      tempOutlierCount++;
      if (settings.excludeTempOutliers) continue;
    }

    validRecords.push(rec);
  }

  // Arduino 内部時刻・イベント番号の増分からライブ時間と推定総イベント数を算出
  // 途中でリセットが入った場合は区間ごとに合算する
  let estimatedTotalEvents = 0;
  let liveTimeMs = 0;

  if (validRecords.length === 1) {
    estimatedTotalEvents = 1;
  } else if (validRecords.length > 1) {
    let segStart = validRecords[0];
    let segPrev = validRecords[0];
    for (let i = 1; i < validRecords.length; i++) {
      const cur = validRecords[i];
      const resetOccurred = cur.ardn_time_ms < segPrev.ardn_time_ms || cur.event < segPrev.event;
      if (resetOccurred) {
        estimatedTotalEvents += Math.max(1, segPrev.event - segStart.event + 1);
        liveTimeMs += Math.max(
          0,
          segPrev.ardn_time_ms - segStart.ardn_time_ms - Math.max(0, segPrev.deadtime_ms - segStart.deadtime_ms),
        );
        segStart = cur;
      }
      segPrev = cur;
    }
    estimatedTotalEvents += Math.max(1, segPrev.event - segStart.event + 1);
    liveTimeMs += Math.max(
      0,
      segPrev.ardn_time_ms - segStart.ardn_time_ms - Math.max(0, segPrev.deadtime_ms - segStart.deadtime_ms),
    );
  }

  const liveTimeSec = liveTimeMs / 1000;
  const totalRawLines = dataset.rawRecords.length + dataset.malformedLines.length;
  const validCount = validRecords.length;
  const captureRatioPercent =
    estimatedTotalEvents > 0 ? Math.min(100, (validCount / estimatedTotalEvents) * 100) : 0;

  // 欠落補正済み計数率（イベント番号増分ベース）
  const totalRatePerMin = liveTimeSec > 0 ? (estimatedTotalEvents / liveTimeSec) * 60 : 0;

  let aboveThresholdCount = 0;
  let sipmSum = 0;
  let tempSum = 0;
  const sipmValues: number[] = [];

  for (const rec of validRecords) {
    sipmValues.push(rec.sipm_mV);
    sipmSum += rec.sipm_mV;
    tempSum += rec.temp_C;
    if (rec.sipm_mV > settings.sipmThresholdMv) {
      aboveThresholdCount++;
    }
  }

  sipmValues.sort((a, b) => a - b);
  const medianSipmMv =
    sipmValues.length > 0 ? sipmValues[Math.floor(sipmValues.length / 2)] : 0;
  const meanSipmMv = validCount > 0 ? sipmSum / validCount : 0;
  const meanTempC = validCount > 0 ? tempSum / validCount : 0;
  const aboveThresholdRatioPercent = validCount > 0 ? (aboveThresholdCount / validCount) * 100 : 0;
  const aboveThresholdRatePerMin = totalRatePerMin * (aboveThresholdRatioPercent / 100);

  const metrics: DatasetQualityMetrics = {
    totalRawLines,
    duplicateCount,
    malformedCount: dataset.malformedLines.length,
    tempOutlierCount,
    validCount,
    estimatedTotalEvents,
    captureRatioPercent,
    liveTimeSec,
    totalRatePerMin,
    aboveThresholdRatePerMin,
    aboveThresholdCount,
    aboveThresholdRatioPercent,
    meanSipmMv,
    medianSipmMv,
    meanTempC,
    railedA0Count,
  };

  return { dataset, validRecords, metrics };
}

/**
 * 対数スケール SiPM 出力分布ヒストグラム（イベント割合 [%]）を構築
 */
export function buildSipmHistogram(
  analyzedList: AnalyzedDataset[],
  binCount = 24,
  minMv = 15,
  maxMv = 1500,
): HistogramBin[] {
  const logMin = Math.log10(minMv);
  const logMax = Math.log10(maxMv);
  const step = (logMax - logMin) / binCount;

  const edges: number[] = [];
  for (let i = 0; i <= binCount; i++) {
    edges.push(Math.pow(10, logMin + i * step));
  }

  const bins: HistogramBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const center = Math.sqrt(edges[i] * edges[i + 1]);
    bins.push({
      binCenterMv: Number(center.toFixed(1)),
      label: `${Math.round(center)} mV`,
    });
  }

  for (const item of analyzedList) {
    const counts = new Array<number>(binCount).fill(0);
    const total = item.validRecords.length;
    for (const rec of item.validRecords) {
      if (rec.sipm_mV < minMv || rec.sipm_mV > maxMv) continue;
      const idx = Math.min(
        binCount - 1,
        Math.max(0, Math.floor((Math.log10(rec.sipm_mV) - logMin) / step)),
      );
      counts[idx]++;
    }
    for (let i = 0; i < binCount; i++) {
      bins[i][item.dataset.id] = total > 0 ? Number(((counts[i] / total) * 100).toFixed(2)) : 0;
    }
  }

  return bins;
}

/**
 * 条件ペアごとの統計検定マトリクス（Mann–Whitney U / KS / 比率検定）
 */
export function computePairwiseTests(
  analyzedList: AnalyzedDataset[],
  sipmThresholdMv: number,
): PairwiseTestResult[] {
  const results: PairwiseTestResult[] = [];
  for (let i = 0; i < analyzedList.length; i++) {
    for (let j = i + 1; j < analyzedList.length; j++) {
      const a = analyzedList[i];
      const b = analyzedList[j];
      const valsA = a.validRecords.map((r) => r.sipm_mV);
      const valsB = b.validRecords.map((r) => r.sipm_mV);
      const aboveA = valsA.filter((v) => v > sipmThresholdMv).length;
      const aboveB = valsB.filter((v) => v > sipmThresholdMv).length;

      results.push({
        idA: a.dataset.id,
        labelA: a.dataset.conditionLabel,
        idB: b.dataset.id,
        labelB: b.dataset.conditionLabel,
        mannWhitneyP: mannWhitneyU(valsA, valsB),
        ksP: kolmogorovSmirnov2Sample(valsA, valsB),
        proportionP: twoProportionZTest(aboveA, valsA.length, aboveB, valsB.length),
      });
    }
  }
  return results;
}
