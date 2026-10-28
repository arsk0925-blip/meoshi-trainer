import { describe, expect, it } from 'vitest';
import { adjustPressTime, clampOffset, formatOffset, suggestOffset } from './calibration';
import type { TrialRecord } from './records';

function bita(msBias: number, timingOffsetMs: number): TrialRecord {
  return {
    id: 'x',
    recordedAt: '2026-10-28T00:00:00.000Z',
    machineId: 'machine-a',
    mode: 'bita',
    success: false,
    framesOff: 1,
    msOff: Math.abs(msBias),
    msBias,
    timingOffsetMs,
  };
}

describe('adjustPressTime', () => {
  it('正の調整値はタップを早めたものとして扱う', () => {
    expect(adjustPressTime(1000, 40)).toBe(960);
    expect(adjustPressTime(1000, -20)).toBe(1020);
  });
});

describe('clampOffset', () => {
  it('5ms刻み・±200ms に収める', () => {
    expect(clampOffset(42)).toBe(40);
    expect(clampOffset(43)).toBe(45);
    expect(clampOffset(500)).toBe(200);
    expect(clampOffset(-500)).toBe(-200);
    expect(Object.is(clampOffset(-1), 0)).toBe(true);
  });
});

describe('suggestOffset', () => {
  it('試行が10回未満なら出さない', () => {
    expect(suggestOffset(Array.from({ length: 9 }, () => bita(50, 0)))).toBeNull();
  });

  it('いつも50ms遅れていれば 50ms 早める', () => {
    expect(suggestOffset(Array.from({ length: 10 }, () => bita(50, 0)))).toEqual({ offsetMs: 50, trials: 10 });
  });

  it('すでに調整していた試行は、調整なしの場合のずれに直して平均する', () => {
    // 調整 30ms で +20ms 遅れ → 調整なしなら +50ms
    const records = [...Array.from({ length: 5 }, () => bita(50, 0)), ...Array.from({ length: 5 }, () => bita(20, 30))];
    expect(suggestOffset(records)?.offsetMs).toBe(50);
  });

  it('直近20回だけを使い、ビタ押し以外や古い記録（調整値なし）は無視する', () => {
    const old = Array.from({ length: 30 }, () => bita(-100, 0));
    const recent = Array.from({ length: 20 }, () => bita(30, 0));
    const other = { ...bita(500, 0), mode: 'big' as const };
    const legacy = { ...bita(500, 0), timingOffsetMs: undefined };
    expect(suggestOffset([...old, ...recent, other, legacy])).toEqual({ offsetMs: 30, trials: 20 });
  });
});

describe('formatOffset', () => {
  it('表示', () => {
    expect(formatOffset(0)).toBe('0ms（調整なし）');
    expect(formatOffset(40)).toBe('40ms 早める');
    expect(formatOffset(-15)).toBe('15ms 遅らせる');
  });
});
