import { describe, expect, it } from 'vitest';
import { loadMachines, msPerSymbol, parseMachine } from './machine';

const valid = {
  id: 'x',
  name: 'テスト',
  msPerRevolution: 750,
  lines: [['middle', 'middle', 'middle']],
  reels: [['7', 'BAR'], ['7', 'BAR'], ['7', 'BAR']],
};

describe('parseMachine', () => {
  it('正しいデータはそのまま通す', () => {
    expect(parseMachine(valid).id).toBe('x');
  });

  it('不正なデータはエラー', () => {
    expect(() => parseMachine({ ...valid, reels: [['7'], ['7']] })).toThrow('3本');
    expect(() => parseMachine({ ...valid, reels: [['7'], ['star'], ['7']] })).toThrow('star');
    expect(() => parseMachine({ ...valid, lines: [['middle', 'center', 'middle']] })).toThrow('lines[0]');
    expect(() => parseMachine({ ...valid, msPerRevolution: 0 })).toThrow('msPerRevolution');
    expect(() => parseMachine(null)).toThrow('id');
  });
});

describe('同梱の機種データ', () => {
  const machines = loadMachines();

  it('2機種あり、表示名にメーカーの商標を含まない', () => {
    expect(machines.map((m) => m.id)).toEqual(['machine-a', 'machine-b']);
    for (const m of machines) expect(m.name).not.toMatch(/ジャグラー|juggler/i);
  });

  it('各リール21コマ・1コマ約36ms', () => {
    for (const m of machines) {
      for (const [i, strip] of m.reels.entries()) {
        expect(strip).toHaveLength(21);
        expect(msPerSymbol(m, i)).toBeCloseTo(35.7, 1);
      }
    }
  });

  it('全リールに 7 と BAR があり、左リールにチェリーがある（揃え練習に必要）', () => {
    for (const m of machines) {
      for (const strip of m.reels) {
        expect(strip).toContain('7');
        expect(strip).toContain('BAR');
      }
      expect(m.reels[0]).toContain('cherry');
    }
  });
});
