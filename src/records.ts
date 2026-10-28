// 試行ログの保存と集計
// v2 でサーバーへ移す前提で、1件 = 1レコードのフラットな構造にする
import type { Streak } from './align';
import type { ModeId } from './modes';

export interface TrialRecord {
  id: string; // UUID
  recordedAt: string; // ISO 8601
  machineId: string;
  mode: ModeId;
  success: boolean;
  /** 止めたリールの「狙い図柄からのずれコマ数」の絶対値の平均 */
  framesOff: number;
  /** 止めたリールの「理想タイミングからのずれms」の絶対値の平均 */
  msOff: number;
  /** 止めたリールの「理想タイミングからのずれms」の平均（符号つき。負=早い、正=遅い）。タイミング調整に使う */
  msBias?: number;
  /** この試行時のタイミング調整値(ms) */
  timingOffsetMs?: number;
}

const RECORDS_KEY = 'meoshi.records.v1';
const STREAKS_KEY = 'meoshi.streaks.v1';
const SETTINGS_KEY = 'meoshi.settings.v1';

/** UUID v4。crypto.randomUUID は https でしか使えないので、LAN の http でも動くよう自前で作る */
export function uuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function loadRecords(storage: Storage): TrialRecord[] {
  const records = readJson<unknown>(storage, RECORDS_KEY, []);
  return Array.isArray(records) ? (records as TrialRecord[]) : [];
}

/** 保存に失敗したら（容量不足・プライベートモード等）false */
export function appendRecord(storage: Storage, record: TrialRecord): boolean {
  try {
    storage.setItem(RECORDS_KEY, JSON.stringify([...loadRecords(storage), record]));
    return true;
  } catch {
    return false;
  }
}

export type Streaks = Partial<Record<ModeId, Streak>>;

export function loadStreaks(storage: Storage): Streaks {
  const streaks = readJson<unknown>(storage, STREAKS_KEY, {});
  return streaks !== null && typeof streaks === 'object' ? (streaks as Streaks) : {};
}

export function saveStreaks(storage: Storage, streaks: Streaks): boolean {
  try {
    storage.setItem(STREAKS_KEY, JSON.stringify(streaks));
    return true;
  } catch {
    return false;
  }
}

export interface Settings {
  timingOffsetMs: number;
}

export function loadSettings(storage: Storage): Settings {
  const saved = readJson<unknown>(storage, SETTINGS_KEY, {});
  const offset = (saved as Partial<Settings> | null)?.timingOffsetMs;
  return { timingOffsetMs: typeof offset === 'number' && Number.isFinite(offset) ? offset : 0 };
}

export function saveSettings(storage: Storage, settings: Settings): boolean {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export interface Summary {
  trials: number;
  successes: number;
  framesOff: number;
  msOff: number;
}

function summarize(records: readonly TrialRecord[]): Summary {
  const trials = records.length;
  const sum = (f: (r: TrialRecord) => number) => records.reduce((acc, r) => acc + f(r), 0);
  return {
    trials,
    successes: records.filter((r) => r.success).length,
    framesOff: trials ? sum((r) => r.framesOff) / trials : 0,
    msOff: trials ? sum((r) => r.msOff) / trials : 0,
  };
}

export function summaryByMode(records: readonly TrialRecord[], mode: ModeId): Summary {
  return summarize(records.filter((r) => r.mode === mode));
}

/** 端末のタイムゾーンでの日付 YYYY-MM-DD */
export function localDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** モードごとの日別集計（新しい日付が先） */
export function dailyByMode(records: readonly TrialRecord[], mode: ModeId): { date: string; summary: Summary }[] {
  const byDate = new Map<string, TrialRecord[]>();
  for (const r of records) {
    if (r.mode !== mode) continue;
    const date = localDate(r.recordedAt);
    byDate.set(date, [...(byDate.get(date) ?? []), r]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, rs]) => ({ date, summary: summarize(rs) }));
}
