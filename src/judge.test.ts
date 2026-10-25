import { describe, expect, it } from 'vitest';
import { bitaDeviation, formatFrames, formatMs } from './judge';
import type { SymbolId } from './reel';

// 7 は 0番目にだけある配列
const STRIP: SymbolId[] = ['7', ...Array<SymbolId>(20).fill('grape')];
const MS = 36;

describe('bitaDeviation', () => {
  it('理想タイミング（狙いの0.5コマ手前）で押すとビタ・0ms', () => {
    expect(bitaDeviation(STRIP, '7', -0.5, MS)).toEqual({ frames: 0, ms: 0 });
    // 1周後も同じ
    expect(bitaDeviation(STRIP, '7', 20.5, MS)).toEqual({ frames: 0, ms: 0 });
  });

  it('ビタの範囲内のずれは ms だけ出る', () => {
    const r = bitaDeviation(STRIP, '7', -0.25, MS);
    expect(r.frames).toBe(0);
    expect(r.ms).toBeCloseTo(9);
  });

  it('遅く押すと正のコマ数・正の ms', () => {
    const r = bitaDeviation(STRIP, '7', 1.5, MS);
    expect(r.frames).toBe(2);
    expect(r.ms).toBeCloseTo(72);
  });

  it('早く押すと負のコマ数・負の ms', () => {
    const r = bitaDeviation(STRIP, '7', 18.5, MS);
    expect(r.frames).toBe(-2);
    expect(r.ms).toBeCloseTo(-72);
  });

  it('狙い図柄が複数あるときは近いほうを狙いとみなす', () => {
    const strip: SymbolId[] = [...STRIP];
    strip[10] = '7';
    expect(bitaDeviation(strip, '7', 10.5, MS).frames).toBe(1);
    expect(bitaDeviation(strip, '7', 8.5, MS).frames).toBe(-1);
  });

  it('配列にない図柄はエラー', () => {
    expect(() => bitaDeviation(STRIP, 'BAR', 0, MS)).toThrow();
  });
});

describe('表示', () => {
  it('コマ数', () => {
    expect(formatFrames(0)).toBe('ビタ');
    expect(formatFrames(-1)).toBe('1コマ早い');
    expect(formatFrames(2)).toBe('2コマ遅い');
  });

  it('ms', () => {
    expect(formatMs(12.4)).toBe('+12ms');
    expect(formatMs(-30.6)).toBe('-31ms');
    expect(formatMs(0)).toBe('0ms');
  });
});
