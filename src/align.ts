// 揃え練習の判定（引き込み・揃い判定・連続成功数）。描画から分離した純粋関数
import { mod, type SymbolId } from './reel';
import type { Row } from './machine';

export const MAX_SLIP = 4;

/** 揃えたい図柄 [左, 中, 右]。null のリールは問わない */
export type Goal = [SymbolId | null, SymbolId | null, SymbolId | null];

const ROW_OFFSET: Record<Row, number> = { top: 1, middle: 0, bottom: -1 };

/** 停止位置 stop のとき、その段に見えている図柄（上段 = 1つ番号が大きい図柄） */
export function symbolInRow(strip: readonly SymbolId[], stop: number, row: Row): SymbolId {
  return strip[mod(stop + ROW_OFFSET[row], strip.length)];
}

/** 止まっているリールだけ見て、このラインはまだ goal を揃えられるか */
function lineStillPossible(
  strips: readonly (readonly SymbolId[])[],
  stops: readonly (number | null)[],
  goal: Goal,
  line: readonly Row[],
): boolean {
  return goal.every((want, i) => {
    const stop = stops[i];
    return want === null || stop === null || symbolInRow(strips[i], stop, line[i]) === want;
  });
}

/**
 * 引き込みありの停止位置。
 * スベリなしの停止位置 base から 0〜MAX_SLIP コマの範囲で、
 * 止まっている他リールと合わせてまだ揃う可能性のあるライン上に goal の図柄が来る、最小のスベリで止める。
 * 届かなければスベリなし（base）で止める。
 */
export function stopWithPullIn(
  strips: readonly (readonly SymbolId[])[],
  stops: readonly (number | null)[],
  reelIndex: number,
  base: number,
  goal: Goal,
  lines: readonly (readonly Row[])[],
): number {
  const want = goal[reelIndex];
  if (want === null) return base;
  for (let slip = 0; slip <= MAX_SLIP; slip++) {
    const stop = base + slip;
    const next = stops.map((s, i) => (i === reelIndex ? stop : s));
    if (lines.some((line) => symbolInRow(strips[reelIndex], stop, line[reelIndex]) === want &&
      lineStillPossible(strips, next, goal, line))) {
      return stop;
    }
  }
  return base;
}

/** goal が揃ったラインの番号。揃っていなければ -1。goal が null のリールは見ない */
export function alignedLine(
  strips: readonly (readonly SymbolId[])[],
  stops: readonly (number | null)[],
  goal: Goal,
  lines: readonly (readonly Row[])[],
): number {
  if (goal.some((want, i) => want !== null && stops[i] === null)) return -1;
  return lines.findIndex((line) => lineStillPossible(strips, stops, goal, line));
}

export interface Streak {
  current: number;
  best: number;
}

/** 成功で現在の連続数を+1、失敗で0に戻す。最高記録は残す */
export function nextStreak(streak: Streak, success: boolean): Streak {
  const current = success ? streak.current + 1 : 0;
  return { current, best: Math.max(streak.best, current) };
}
