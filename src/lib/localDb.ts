import type { ExperimentDataset } from '../types/cosmicwatch';

const DB_NAME = 'cosmos-muon-local-db';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';

/**
 * IndexedDB を開く（非破壊ローカル保存専用：削除操作は一切提供しない）
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

/**
 * ローカルに保存された全データセットを読み込む
 */
export async function loadSavedDatasets(): Promise<ExperimentDataset[]> {
  try {
    const db = await openDb();
    return await new Promise<ExperimentDataset[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as ExperimentDataset[]) ?? [];
        items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * データセットを非破壊でローカル保存（追加・追記保存のみ）
 */
export async function saveDatasetLocally(dataset: ExperimentDataset): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(dataset);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // プライベートモード等で IndexedDB が使えない環境でもアプリは継続動作する
  }
}
