export type DetectorMode = 'MASTER' | 'SLAVE' | 'UNKNOWN';

export interface RawEventRecord {
  pc_time: string;
  event: number;
  ardn_time_ms: number;
  adc: number;
  sipm_mV: number;
  deadtime_ms: number;
  temp_C: number;
  rawLine?: string;
}

export interface ExperimentDataset {
  id: string;
  name: string;
  conditionLabel: string;
  moisturePercent: number | null; // null = 砂なし（基準）
  sandDepthCm: number;
  sandMassKg: number;
  detectorMode: DetectorMode;
  detectorName?: string;
  source: 'preset' | 'csv' | 'serial';
  createdAt: string;
  color: string;
  /** 非破壊保持する生レコード一覧（削除不可） */
  rawRecords: RawEventRecord[];
  /** パース不能・破損行の記録（非破壊保持） */
  malformedLines: string[];
}

export interface FilterSettings {
  tempMin: number;
  tempMax: number;
  sipmThresholdMv: number;
  excludeDuplicates: boolean;
  excludeTempOutliers: boolean;
}

export interface DatasetQualityMetrics {
  totalRawLines: number;
  duplicateCount: number;
  malformedCount: number;
  tempOutlierCount: number;
  validCount: number;
  estimatedTotalEvents: number;
  captureRatioPercent: number;
  liveTimeSec: number;
  totalRatePerMin: number;
  aboveThresholdRatePerMin: number;
  aboveThresholdCount: number;
  aboveThresholdRatioPercent: number;
  meanSipmMv: number;
  medianSipmMv: number;
  meanTempC: number;
  railedA0Count: number;
}

export interface AnalyzedDataset {
  dataset: ExperimentDataset;
  validRecords: RawEventRecord[];
  metrics: DatasetQualityMetrics;
}

export interface PairwiseTestResult {
  idA: string;
  labelA: string;
  idB: string;
  labelB: string;
  mannWhitneyP: number;
  ksP: number;
  proportionP: number;
}

export interface HistogramBin {
  binCenterMv: number;
  label: string;
  [datasetId: string]: number | string;
}
