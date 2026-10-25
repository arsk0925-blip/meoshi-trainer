import { describe, expect, it } from 'vitest';
import {
  mod,
  reelPosition,
  stopPositionWithoutSlip,
  symbolAt,
  type SymbolId,
} from './reel';
import { pressTime } from './input';

const DUMMY_STRIP: SymbolId[] = [
  '7', 'grape', 'replay', 'grape', 'cherry', 'bell', 'grape',
  'BAR', 'replay', 'grape', 'cherry', 'grape', 'clown', 'replay',
  '7', 'grape', 'cherry', 'grape', 'bell', 'replay', 'grape',
];

describe('reelPosition', () => {
  it('経過時間から位置を計算する', () => {
    expect(reelPosition(1000, 1000, 36)).toBe(0);
    expect(reelPosition(1036, 1000, 36)).toBe(1);
    expect(reelPosition(1054, 1000, 36)).toBe(1.5);
  });

  it('開始前の時刻は0として扱う', () => {
    expect(reelPosition(900, 1000, 36)).toBe(0);
  });

  it('停止目標に達したらそれ以上進まない', () => {
    expect(reelPosition(1000 + 36 * 10, 1000, 36, 5)).toBe(5);
    expect(reelPosition(1000 + 36 * 4.5, 1000, 36, 5)).toBe(4.5);
  });
});

describe('stopPositionWithoutSlip', () => {
  it('コマの途中で押したら次のコマで止まる', () => {
    expect(stopPositionWithoutSlip(4.01)).toBe(5);
    expect(stopPositionWithoutSlip(4.99)).toBe(5);
  });

  it('ちょうどコマ位置で押したらそのコマで止まる', () => {
    expect(stopPositionWithoutSlip(5)).toBe(5);
    expect(stopPositionWithoutSlip(5 + 1e-12)).toBe(5);
  });

  it('時間から計算した位置で止める（フレームに依存しない）', () => {
    const msPerSymbol = 750 / 21;
    const press = 1000 + msPerSymbol * 7.3;
    expect(stopPositionWithoutSlip(reelPosition(press, 1000, msPerSymbol))).toBe(8);
  });
});

describe('symbolAt', () => {
  it('配列は21コマ', () => {
    expect(DUMMY_STRIP).toHaveLength(21);
  });

  it('位置を配列長で折り返して図柄を返す', () => {
    expect(symbolAt(DUMMY_STRIP, 0)).toBe(DUMMY_STRIP[0]);
    expect(symbolAt(DUMMY_STRIP, 21)).toBe(DUMMY_STRIP[0]);
    expect(symbolAt(DUMMY_STRIP, 22 + 21 * 3)).toBe(DUMMY_STRIP[1]);
    expect(symbolAt(DUMMY_STRIP, -1)).toBe(DUMMY_STRIP[20]);
  });

  it('mod は負数でも 0..length-1 を返す', () => {
    expect(mod(-1, 21)).toBe(20);
    expect(mod(42, 21)).toBe(0);
  });
});

describe('pressTime', () => {
  it('同じ時間軸の timeStamp はそのまま使う', () => {
    expect(pressTime(990, 1000)).toBe(990);
  });

  it('時間軸が違う timeStamp は now にフォールバック', () => {
    expect(pressTime(1_700_000_000_000, 1000)).toBe(1000);
    expect(pressTime(0, 1000)).toBe(1000);
  });
});
