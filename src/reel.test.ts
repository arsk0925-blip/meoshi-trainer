import { describe, expect, it } from 'vitest';
import {
  ACCEL_MS,
  bounceOffset,
  canStop,
  REWIND_MS,
  rewindOffset,
  distanceAt,
  mod,
  reelPosition,
  stopTime,
  timeForDistance,
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

describe('reelPosition（加速なし）', () => {
  it('経過時間から位置を計算する', () => {
    expect(reelPosition(1000, 1000, 36, null, 0, 0)).toBe(0);
    expect(reelPosition(1036, 1000, 36, null, 0, 0)).toBe(1);
    expect(reelPosition(1054, 1000, 36, null, 0, 0)).toBe(1.5);
  });

  it('開始前の時刻は0として扱う', () => {
    expect(reelPosition(900, 1000, 36, null, 0, 0)).toBe(0);
  });

  it('停止目標に達したらそれ以上進まない', () => {
    expect(reelPosition(1000 + 36 * 10, 1000, 36, 5, 0, 0)).toBe(5);
    expect(reelPosition(1000 + 36 * 4.5, 1000, 36, 5, 0, 0)).toBe(4.5);
  });

  it('開始位置から進む', () => {
    expect(reelPosition(1036, 1000, 36, null, 7, 0)).toBe(8);
  });
});

describe('加速', () => {
  const ms = 36;

  it('加速中は等加速度、加速後は一定速度', () => {
    // 加速終了時点で ACCEL_MS / 2 / ms コマ進んでいる
    expect(distanceAt(ACCEL_MS, ms)).toBeCloseTo(ACCEL_MS / 2 / ms);
    // その後は 1コマ ms で進む
    expect(distanceAt(ACCEL_MS + ms * 3, ms) - distanceAt(ACCEL_MS, ms)).toBeCloseTo(3);
    // 加速中は速度が遅い（同じ時間で進む距離が短い）
    expect(distanceAt(100, ms)).toBeLessThan(100 / ms);
  });

  it('速度が途切れない（加速終了の前後で位置がつながる）', () => {
    expect(distanceAt(ACCEL_MS - 0.001, ms)).toBeCloseTo(distanceAt(ACCEL_MS, ms), 4);
  });

  it('timeForDistance は distanceAt の逆関数', () => {
    for (const t of [0, 50, 150, ACCEL_MS, 500, 2000]) {
      expect(timeForDistance(distanceAt(t, ms), ms)).toBeCloseTo(t, 6);
    }
  });

  it('最高速に達するまで停止を受け付けない', () => {
    expect(canStop(1000 + ACCEL_MS - 1, 1000)).toBe(false);
    expect(canStop(1000 + ACCEL_MS, 1000)).toBe(true);
  });

  it('停止目標に到達する時刻', () => {
    const t = stopTime(1000, ms, 30, 2);
    expect(reelPosition(t, 1000, ms, null, 2)).toBeCloseTo(30);
  });
});

describe('停止時の揺れ', () => {
  it('止まった瞬間と、揺れ終わった後は 0', () => {
    expect(bounceOffset(0)).toBe(0);
    expect(bounceOffset(1000)).toBe(0);
  });

  it('揺れは小さい（0.1コマ未満）', () => {
    for (let t = 0; t < 200; t += 5) expect(Math.abs(bounceOffset(t))).toBeLessThan(0.1);
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
    expect(stopPositionWithoutSlip(reelPosition(press, 1000, msPerSymbol, null, 0, 0))).toBe(8);
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

describe('停止位置を通り過ぎていたときの戻り', () => {
  it('通り過ぎた分から 0 へ単調に戻る', () => {
    expect(rewindOffset(1.5, 0)).toBe(1.5);
    expect(rewindOffset(1.5, REWIND_MS / 2)).toBeLessThan(1.5);
    expect(rewindOffset(1.5, REWIND_MS / 2)).toBeGreaterThan(rewindOffset(1.5, REWIND_MS * 0.8));
    expect(rewindOffset(1.5, REWIND_MS)).toBe(0);
  });

  it('通り過ぎていなければ戻らない', () => {
    expect(rewindOffset(0, 10)).toBe(0);
    expect(rewindOffset(-0.5, 10)).toBe(0);
  });
});
