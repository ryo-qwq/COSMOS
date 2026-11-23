import type { DetectorMode, RawEventRecord } from '../types/cosmicwatch';

export interface ParsedLineResult {
  type: 'data' | 'banner' | 'header' | 'empty' | 'malformed';
  record?: RawEventRecord;
  bannerText?: string;
  detectedMode?: DetectorMode;
  detectorName?: string;
}

const ISO_LIKE_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;

/**
 * CosmicWatch の 1 行を柔軟にパースする。
 * - cosmicwatch.py 出力: pc_time,event,ardn_time_ms,adc,sipm_mV,deadtime_ms,temp_C
 * - Arduino OLED.ino / SDCard.ino 生出力: event ardn_time_ms adc sipm_mV deadtime_ms temp_C (スペース or カンマ区切り)
 */
export function parseCosmicWatchLine(line: string, fallbackTimeIso?: string): ParsedLineResult {
  const trimmed = line.trim();
  if (!trimmed) {
    return { type: 'empty' };
  }

  // バナー行 (### ...)
  if (trimmed.startsWith('#')) {
    const upper = trimmed.toUpperCase();
    let detectedMode: DetectorMode | undefined;
    if (upper.includes('SLAVE')) {
      detectedMode = 'SLAVE';
    } else if (upper.includes('MASTER')) {
      detectedMode = 'MASTER';
    }
    return {
      type: 'banner',
      bannerText: trimmed.replace(/^#+\s*/, ''),
      detectedMode,
    };
  }

  // ヘッダー行
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('pc_time') ||
    lower.startsWith('event,') ||
    lower.startsWith('event ') ||
    lower.includes('ardn_time_ms') ||
    lower.includes('sipm_mv')
  ) {
    return { type: 'header' };
  }

  // SD初期化失敗などのシステムメッセージ
  if (lower.includes('sd initialization') || lower.includes('comp_time')) {
    return { type: 'banner', bannerText: trimmed };
  }

  // カンマ・タブ・空白で分割
  const parts = trimmed.replace(/,/g, ' ').split(/\s+/).filter(Boolean);

  // 7列形式（先頭がタイムスタンプ）
  if (parts.length >= 7 && ISO_LIKE_RE.test(parts[0])) {
    const pc_time = parts[0];
    const event = Number(parts[1]);
    const ardn_time_ms = Number(parts[2]);
    const adc = Number(parts[3]);
    const sipm_mV = Number(parts[4]);
    const deadtime_ms = Number(parts[5]);
    const temp_C = Number(parts[6]);

    if (
      Number.isInteger(event) &&
      event >= 0 &&
      Number.isFinite(ardn_time_ms) &&
      ardn_time_ms >= 0 &&
      Number.isFinite(adc) &&
      adc >= 0 &&
      adc <= 1024 &&
      Number.isFinite(sipm_mV) &&
      sipm_mV >= 0 &&
      Number.isFinite(deadtime_ms) &&
      deadtime_ms >= 0 &&
      Number.isFinite(temp_C) &&
      temp_C > -50 &&
      temp_C < 120
    ) {
      return {
        type: 'data',
        record: {
          pc_time,
          event,
          ardn_time_ms,
          adc,
          sipm_mV,
          deadtime_ms,
          temp_C,
          rawLine: trimmed,
        },
      };
    }
    return { type: 'malformed' };
  }

  // 6列形式（タイムスタンプなしのArduino生出力）
  if (parts.length >= 6) {
    const event = Number(parts[0]);
    const ardn_time_ms = Number(parts[1]);
    const adc = Number(parts[2]);
    const sipm_mV = Number(parts[3]);
    const deadtime_ms = Number(parts[4]);
    const temp_C = Number(parts[5]);

    if (
      Number.isInteger(event) &&
      event >= 0 &&
      Number.isFinite(ardn_time_ms) &&
      ardn_time_ms >= 0 &&
      Number.isFinite(adc) &&
      adc >= 0 &&
      adc <= 1024 &&
      Number.isFinite(sipm_mV) &&
      sipm_mV >= 0 &&
      Number.isFinite(deadtime_ms) &&
      deadtime_ms >= 0 &&
      Number.isFinite(temp_C) &&
      temp_C > -50 &&
      temp_C < 120
    ) {
      return {
        type: 'data',
        record: {
          pc_time: fallbackTimeIso ?? new Date().toISOString(),
          event,
          ardn_time_ms,
          adc,
          sipm_mV,
          deadtime_ms,
          temp_C,
          rawLine: trimmed,
        },
      };
    }
  }

  // 単一トークンで英数字・ハイフンの場合は検出器名バナーの可能性
  if (parts.length === 1 && /^[A-Za-z0-9_-]{2,39}$/.test(parts[0])) {
    return {
      type: 'banner',
      bannerText: parts[0],
      detectorName: parts[0],
    };
  }

  return { type: 'malformed' };
}

export interface ParsedCsvResult {
  rawRecords: RawEventRecord[];
  malformedLines: string[];
  detectedMode: DetectorMode;
  detectorName?: string;
}

export function parseCosmicWatchCsv(rawText: string): ParsedCsvResult {
  const lines = rawText.split(/\r?\n/);
  const rawRecords: RawEventRecord[] = [];
  const malformedLines: string[] = [];
  let detectedMode: DetectorMode = 'UNKNOWN';
  let detectorName: string | undefined;

  for (const line of lines) {
    const res = parseCosmicWatchLine(line);
    if (res.type === 'data' && res.record) {
      rawRecords.push(res.record);
    } else if (res.type === 'malformed') {
      malformedLines.push(line);
    } else if (res.type === 'banner') {
      if (res.detectedMode) detectedMode = res.detectedMode;
      if (res.detectorName) detectorName = res.detectorName;
    }
  }

  return { rawRecords, malformedLines, detectedMode, detectorName };
}

/**
 * 生イベント配列を cosmicwatch.py 準拠の CSV テキストに変換する（非破壊エクスポート用）
 */
export function recordsToCsv(records: RawEventRecord[]): string {
  const header = 'pc_time,event,ardn_time_ms,adc,sipm_mV,deadtime_ms,temp_C';
  const rows = records.map(
    (r) =>
      `${r.pc_time},${r.event},${r.ardn_time_ms},${r.adc},${r.sipm_mV.toFixed(2)},${r.deadtime_ms.toFixed(1)},${r.temp_C.toFixed(2)}`,
  );
  return [header, ...rows].join('\n');
}
