import { describe, expect, it } from 'vitest';
import {
  appendRecord,
  dailyByMode,
  loadRecords,
  loadSettings,
  loadStreaks,
  saveSettings,
  saveStreaks,
  summaryByMode,
  uuid,
  type TrialRecord,
} from './records';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
}

function record(overrides: Partial<TrialRecord>): TrialRecord {
  return {
    id: uuid(),
    recordedAt: new Date(2026, 9, 25, 12).toISOString(),
    machineId: 'machine-a',
    mode: 'big',
    success: true,
    framesOff: 0,
    msOff: 0,
    ...overrides,
  };
}

describe('uuid', () => {
  it('UUID v4 の形式で、毎回違う', () => {
    const a = uuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid()).not.toBe(a);
  });
});

describe('保存と読み込み', () => {
  it('追記した試行ログを読み戻せる（再読込しても残る）', () => {
    const storage = new MemoryStorage();
    const r1 = record({});
    const r2 = record({ success: false });
    expect(appendRecord(storage, r1)).toBe(true);
    expect(appendRecord(storage, r2)).toBe(true);
    expect(loadRecords(storage)).toEqual([r1, r2]);
  });

  it('連続成功数を保存して読み戻せる', () => {
    const storage = new MemoryStorage();
    saveStreaks(storage, { big: { current: 2, best: 5 } });
    expect(loadStreaks(storage)).toEqual({ big: { current: 2, best: 5 } });
  });

  it('壊れたデータや空の状態でも落ちない', () => {
    const storage = new MemoryStorage();
    expect(loadRecords(storage)).toEqual([]);
    expect(loadStreaks(storage)).toEqual({});
    storage.setItem('meoshi.records.v1', '{broken');
    storage.setItem('meoshi.streaks.v1', 'null');
    expect(loadRecords(storage)).toEqual([]);
    expect(loadStreaks(storage)).toEqual({});
  });

  it('設定を保存して読み戻せる。未保存・壊れた値は既定値', () => {
    const storage = new MemoryStorage();
    expect(loadSettings(storage)).toEqual({ timingOffsetMs: 0, soundEnabled: true, volume: 0.7 });
    saveSettings(storage, { timingOffsetMs: 40, soundEnabled: false, volume: 0.3 });
    expect(loadSettings(storage)).toEqual({ timingOffsetMs: 40, soundEnabled: false, volume: 0.3 });
    storage.setItem('meoshi.settings.v1', '{"timingOffsetMs":"x","soundEnabled":1,"volume":5}');
    expect(loadSettings(storage)).toEqual({ timingOffsetMs: 0, soundEnabled: true, volume: 0.7 });
  });

  it('書き込みに失敗したら false を返す', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    expect(appendRecord(storage, record({}))).toBe(false);
    expect(saveStreaks(storage, {})).toBe(false);
  });
});

describe('集計', () => {
  const records = [
    record({ mode: 'big', success: true, framesOff: 1, msOff: 20 }),
    record({ mode: 'big', success: false, framesOff: 3, msOff: 100 }),
    record({ mode: 'reg', success: true }),
    record({ mode: 'big', success: true, recordedAt: new Date(2026, 9, 26, 9).toISOString() }),
  ];

  it('モード別の成功率と平均ずれ', () => {
    expect(summaryByMode(records, 'big')).toEqual({ trials: 3, successes: 2, framesOff: 4 / 3, msOff: 40 });
    expect(summaryByMode(records, 'cherry')).toEqual({ trials: 0, successes: 0, framesOff: 0, msOff: 0 });
  });

  it('日ごとの集計（新しい日付が先）', () => {
    const daily = dailyByMode(records, 'big');
    expect(daily.map((d) => d.date)).toEqual(['2026-10-26', '2026-10-25']);
    expect(daily[1].summary.trials).toBe(2);
    expect(daily[1].summary.successes).toBe(1);
  });
});
