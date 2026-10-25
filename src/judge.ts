// 判定ロジック（描画から分離した純粋関数）
import { mod, stopPositionWithoutSlip, type SymbolId } from './reel';

export interface BitaResult {
  /** 止まったコマ − 狙いのコマ。0 = ビタ、負 = 早い、正 = 遅い */
  frames: number;
  /** 理想の押下タイミングからのずれ(ms)。負 = 早い、正 = 遅い */
  ms: number;
}

/**
 * ビタ押しのずれを計算する（スベリなし）。
 *
 * 狙いの図柄が中段に止まるのは、押下位置 p が (k-1, k] にあるとき（k = 図柄の絶対位置）。
 * その区間の中央 k-0.5 を理想のタイミングとし、そこからのずれを ms で返す。
 * 狙い図柄が配列に複数ある場合は、押下位置にいちばん近いものを狙いとみなす。
 */
export function bitaDeviation(
  strip: readonly SymbolId[],
  target: SymbolId,
  pressPosition: number,
  msPerSymbol: number,
): BitaResult {
  const n = strip.length;
  let best: number | null = null;
  for (let i = 0; i < n; i++) {
    if (strip[i] !== target) continue;
    // 押下位置に最も近い、図柄 i の絶対位置 k を求める
    const ideal = pressPosition + 0.5;
    const r = mod(ideal - i, n);
    const k = Math.round(ideal - r) + (r > n / 2 ? n : 0);
    if (best === null || Math.abs(pressPosition - (k - 0.5)) < Math.abs(pressPosition - (best - 0.5))) {
      best = k;
    }
  }
  if (best === null) {
    throw new Error(`狙い図柄 ${target} が配列にありません`);
  }
  return {
    frames: stopPositionWithoutSlip(pressPosition) - best || 0, // -0 を 0 にそろえる
    ms: (pressPosition - (best - 0.5)) * msPerSymbol,
  };
}

export function formatFrames(frames: number): string {
  if (frames === 0) return 'ビタ';
  return frames < 0 ? `${-frames}コマ早い` : `${frames}コマ遅い`;
}

export function formatMs(ms: number): string {
  const rounded = Math.round(ms);
  return `${rounded > 0 ? '+' : ''}${rounded}ms`;
}
