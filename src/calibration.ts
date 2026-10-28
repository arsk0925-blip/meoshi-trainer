// タイミング調整（端末ごとのタップ・表示の遅れの補正）
//
// offsetMs > 0 のとき、タップを offsetMs だけ早く押したものとして扱う。
// スマホは画面表示とタップ検出に遅れがあり、見たまま押すと実機より遅れて止まりやすいため。
import type { TrialRecord } from './records';

export const OFFSET_MIN = -200;
export const OFFSET_MAX = 200;
export const OFFSET_STEP = 5;
/** 自動調整に使う直近の試行数と、最低限必要な試行数 */
export const CALIBRATION_TRIALS = 20;
export const CALIBRATION_MIN_TRIALS = 10;

export function clampOffset(offsetMs: number): number {
  const stepped = Math.round(offsetMs / OFFSET_STEP) * OFFSET_STEP;
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, stepped)) || 0; // -0 を 0 にそろえる
}

/** 押下時刻に調整を反映する */
export function adjustPressTime(pressTime: number, offsetMs: number): number {
  return pressTime - offsetMs;
}

/**
 * 直近のビタ押しの結果から、おすすめの調整値を出す。
 * 各試行の「調整なしだった場合のずれ」= 記録されたずれ + その時の調整値、の平均を打ち消す値にする。
 * 試行が足りなければ null
 */
export function suggestOffset(records: readonly TrialRecord[]): { offsetMs: number; trials: number } | null {
  const samples = records
    .filter((r) => r.mode === 'bita' && typeof r.msBias === 'number' && typeof r.timingOffsetMs === 'number')
    .slice(-CALIBRATION_TRIALS);
  if (samples.length < CALIBRATION_MIN_TRIALS) return null;
  const rawLate = samples.reduce((acc, r) => acc + r.msBias! + r.timingOffsetMs!, 0) / samples.length;
  return { offsetMs: clampOffset(rawLate), trials: samples.length };
}

export function formatOffset(offsetMs: number): string {
  if (offsetMs === 0) return '0ms（調整なし）';
  return offsetMs > 0 ? `${offsetMs}ms 早める` : `${-offsetMs}ms 遅らせる`;
}
