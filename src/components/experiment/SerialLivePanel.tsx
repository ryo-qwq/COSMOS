import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cable,
  Download,
  HardDrive,
  Play,
  Radio,
  Square,
  Usb,
} from 'lucide-react';
import type { DetectorMode, ExperimentDataset, RawEventRecord } from '../../types/cosmicwatch';
import { parseCosmicWatchLine, recordsToCsv } from '../../lib/parser';

interface SerialPortLike {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}

interface NavigatorWithSerial extends Navigator {
  serial?: {
    requestPort: () => Promise<SerialPortLike>;
  };
}

interface SerialLivePanelProps {
  onStartSession: (dataset: ExperimentDataset) => void;
  onAppendRecord: (datasetId: string, record: RawEventRecord, detectedMode?: DetectorMode, detectorName?: string) => void;
  onAppendMalformed: (datasetId: string, line: string) => void;
  onLiveStateChange: (isLive: boolean) => void;
  activeLiveDataset: ExperimentDataset | null;
}

export function SerialLivePanel({
  onStartSession,
  onAppendRecord,
  onAppendMalformed,
  onLiveStateChange,
  activeLiveDataset,
}: SerialLivePanelProps) {
  const [status, setStatus] = useState<'idle' | 'serial' | 'demo'>('idle');
  const [conditionLabel, setConditionLabel] = useState('実機ライブ測定（含水率 15%）');
  const [moistureInput, setMoistureInput] = useState('15');
  const [sandDepth, setSandDepth] = useState('45');
  const [sandMass, setSandMass] = useState('16.2');
  const [detectedMode, setDetectedMode] = useState<DetectorMode>('UNKNOWN');
  const [detectorName, setDetectorName] = useState<string>('未検出');
  const [lastRecord, setLastRecord] = useState<RawEventRecord | null>(null);
  const [bannerLog, setBannerLog] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [railedWarning, setRailedWarning] = useState(false);

  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const stopFlagRef = useRef(false);
  const demoTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const webSerialSupported =
    typeof navigator !== 'undefined' && Boolean((navigator as NavigatorWithSerial).serial);

  const createNewSession = (sourceLabel: string): ExperimentDataset => {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const moistureNum = moistureInput.trim() === '' ? null : Number(moistureInput);
    const ds: ExperimentDataset = {
      id: `serial-${now.getTime()}`,
      name: `cosmicwatch_${stamp}.csv`,
      conditionLabel: conditionLabel.trim() || sourceLabel,
      moisturePercent: Number.isFinite(moistureNum) ? moistureNum : null,
      sandDepthCm: Number(sandDepth) || 0,
      sandMassKg: Number(sandMass) || 0,
      detectorMode: 'UNKNOWN',
      source: 'serial',
      createdAt: now.toISOString(),
      color: '#34d399',
      rawRecords: [],
      malformedLines: [],
    };
    sessionIdRef.current = ds.id;
    onStartSession(ds);
    return ds;
  };

  const stopCapture = async () => {
    stopFlagRef.current = true;
    if (demoTimerRef.current !== null) {
      window.clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current.releaseLock();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch {
      // ignore close errors
    }
    setStatus('idle');
    onLiveStateChange(false);
  };

  useEffect(() => {
    return () => {
      void stopCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWebSerial = async () => {
    setErrorMsg(null);
    setRailedWarning(false);
    const nav = navigator as NavigatorWithSerial;
    if (!nav.serial) {
      setErrorMsg('このブラウザは Web Serial API に対応していません。Chrome または Edge をご利用ください。');
      return;
    }

    try {
      const port = await nav.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      stopFlagRef.current = false;

      const ds = createNewSession('実機シリアル測定');
      setDetectedMode('UNKNOWN');
      setDetectorName('接続中...');
      setBannerLog([]);
      setStatus('serial');
      onLiveStateChange(true);

      if (!port.readable) {
        setErrorMsg('シリアルポートから読み取りストリームを取得できませんでした。');
        await stopCapture();
        return;
      }

      const decoder = new TextDecoderStream();
      const pipePromise = port.readable.pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>);
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      let buffer = '';
      let railedStreak = 0;
      let latestMode: DetectorMode = 'UNKNOWN';
      let latestName: string | undefined;

      while (!stopFlagRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const parsed = parseCosmicWatchLine(rawLine, new Date().toISOString());
          if (parsed.type === 'data' && parsed.record) {
            setLastRecord(parsed.record);
            if (parsed.record.adc >= 1023) {
              railedStreak++;
              if (railedStreak >= 3) setRailedWarning(true);
            } else {
              railedStreak = 0;
            }
            onAppendRecord(ds.id, parsed.record, latestMode, latestName);
          } else if (parsed.type === 'banner') {
            if (parsed.bannerText) {
              setBannerLog((prev) => [...prev.slice(-4), parsed.bannerText!]);
            }
            if (parsed.detectedMode) {
              latestMode = parsed.detectedMode;
              setDetectedMode(parsed.detectedMode);
            }
            if (parsed.detectorName) {
              latestName = parsed.detectorName;
              setDetectorName(parsed.detectorName);
            }
          } else if (parsed.type === 'malformed') {
            onAppendMalformed(ds.id, rawLine);
          }
        }
      }

      await pipePromise.catch(() => {});
    } catch (err) {
      if ((err as Error)?.name !== 'NotFoundError') {
        setErrorMsg(`接続エラー: ${(err as Error)?.message ?? 'ポートを開けませんでした（Arduino IDE シリアルモニタが開いていないか確認してください）'}`);
      }
      await stopCapture();
    }
  };

  /**
   * 実機が手元にない発表会場でもライブ計測〜ローカル自動保存を実演できるデモ計測モード
   */
  const startDemoCapture = () => {
    setErrorMsg(null);
    setRailedWarning(false);
    const ds = createNewSession('デモライブ計測');
    setDetectedMode('MASTER');
    setDetectorName('detector-A (Demo)');
    setBannerLog(['detector-A', 'Mode: MASTER (Simulated Live Stream)']);
    setStatus('demo');
    onLiveStateChange(true);

    let ev = 0;
    let ardnMs = 1500;
    let deadtime = 0;
    const moisture = Number(moistureInput) || 0;
    const scale = Math.max(0.75, 1 - (moisture / 30) * 0.18);

    demoTimerRef.current = window.setInterval(() => {
      ev += 1;
      ardnMs += Math.round(700 + Math.random() * 800);
      deadtime += 4.0;
      const isHigh = Math.random() < 0.25 * scale;
      const sipmMv = isHigh
        ? Number((52 + Math.random() * 240 * scale).toFixed(2))
        : Number((17 + Math.random() * 29).toFixed(2));
      const adc = Math.min(1020, Math.round(30 + Math.pow(sipmMv, 0.78) * 5.2));
      const tempC = Number((25.2 + (Math.random() - 0.5) * 0.6).toFixed(2));
      const rec: RawEventRecord = {
        pc_time: new Date().toISOString(),
        event: ev,
        ardn_time_ms: ardnMs,
        adc,
        sipm_mV: sipmMv,
        deadtime_ms: deadtime,
        temp_C: tempC,
      };
      setLastRecord(rec);
      onAppendRecord(ds.id, rec, 'MASTER', 'detector-A (Demo)');
    }, 650);
  };

  const handleDownloadLiveCsv = () => {
    if (!activeLiveDataset || activeLiveDataset.rawRecords.length === 0) return;
    const csv = recordsToCsv(activeLiveDataset.rawRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeLiveDataset.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const liveCount = activeLiveDataset?.rawRecords.length ?? 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/75 to-slate-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            <Usb className="h-4 w-4 text-emerald-400" />
            CosmicWatch 実機ライブ計測（Web Serial 9600 baud / ローカル自動保存）
          </h3>
          <p className="text-xs text-slate-400">
            Arduino IDE シリアルモニタを閉じた状態で USB 接続すると、1イベントごとに生データを IndexedDB へ自動保存しながらリアルタイム描画します。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === 'idle' ? (
            <>
              <button
                type="button"
                onClick={startWebSerial}
                disabled={!webSerialSupported}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-sky-500/20 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Cable className="h-3.5 w-3.5" />
                実機 USB 接続して開始
              </button>
              <button
                type="button"
                onClick={startDemoCapture}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
              >
                <Play className="h-3.5 w-3.5" />
                デモライブ計測（発表用）
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void stopCapture()}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-500/25 hover:bg-rose-400"
            >
              <Square className="h-3.5 w-3.5" />
              計測停止（データは保持）
            </button>
          )}

          {activeLiveDataset && liveCount > 0 && (
            <button
              type="button"
              onClick={handleDownloadLiveCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-sky-300 hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5" />
              生 CSV 保存 ({liveCount}件)
            </button>
          )}
        </div>
      </div>

      {/* セッション条件設定（アイドル時） */}
      {status === 'idle' && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <label className="block text-[11px] text-slate-400">今回の測定条件ラベル</label>
            <input
              type="text"
              value={conditionLabel}
              onChange={(e) => setConditionLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400">含水率 (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={moistureInput}
              onChange={(e) => setMoistureInput(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400">砂厚(cm) / 質量(kg)</label>
            <div className="mt-1 flex gap-1">
              <input
                type="number"
                value={sandDepth}
                onChange={(e) => setSandDepth(e.target.value)}
                className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              <input
                type="number"
                step="0.1"
                value={sandMass}
                onChange={(e) => setSandMass(e.target.value)}
                className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* ライブ受信モニター */}
      {status !== 'idle' && (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-emerald-500/30 bg-slate-950/80 p-3.5 sm:grid-cols-5">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              受信ステータス
            </div>
            <div className="mt-1 text-sm font-bold text-white">
              {status === 'serial' ? 'USB 実機受信中' : 'デモ計測中'}
            </div>
            <div className="text-[10px] text-slate-400">
              {detectorName} / {detectedMode}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">累計受信イベント</div>
            <div className="mt-1 font-mono text-lg font-bold text-white">
              {liveCount.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">最新 SiPM 出力</div>
            <div className="mt-1 font-mono text-lg font-bold text-sky-300">
              {lastRecord ? `${lastRecord.sipm_mV.toFixed(1)} mV` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">最新 基板温度</div>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-300">
              {lastRecord ? `${lastRecord.temp_C.toFixed(1)} °C` : '—'}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <HardDrive className="h-3 w-3 text-emerald-400" />
              ローカル保存
            </div>
            <div className="mt-1 text-xs font-semibold text-emerald-300">IndexedDB 自動保存中</div>
            <div className="truncate text-[10px] text-slate-500">
              {bannerLog[bannerLog.length - 1] ?? '待機中...'}
            </div>
          </div>
        </div>
      )}

      {railedWarning && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            ADC=1023 の張り付き（railed-A0 症状）を連続検知しました。検出器アセンブリ（SiPM／遮光）または基板の診断（Diagnostic.ino）を推奨します。
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
