// リールの位置計算・停止判定（描画から分離した純粋関数）
//
// 位置 position は「図柄何コマぶん進んだか」を表す連続値。
// 中段に来ている図柄は strip[mod(position)]。position が増えるほど次の図柄が上から降りてくる。

export type SymbolId = '7' | 'BAR' | 'cherry' | 'grape' | 'bell' | 'clown' | 'replay';

// 浮動小数の誤差で「ちょうど整数」が次のコマに繰り上がらないようにする
const EPSILON = 1e-9;

export function mod(n: number, length: number): number {
  return ((n % length) + length) % length;
}

/**
 * 時刻 now におけるリール位置。
 * stopTarget が決まっていれば、そこに達した時点で止まる。
 */
export function reelPosition(
  now: number,
  startTime: number,
  msPerSymbol: number,
  stopTarget: number | null = null,
): number {
  const position = Math.max(0, now - startTime) / msPerSymbol;
  return stopTarget === null ? position : Math.min(position, stopTarget);
}

/**
 * スベリなしの停止位置。リールは逆回転できないので、
 * 押した瞬間の位置から次に来る図柄の位置（切り上げ）で止まる。
 */
export function stopPositionWithoutSlip(positionAtPress: number): number {
  return Math.ceil(positionAtPress - EPSILON);
}

export function symbolAt(strip: readonly SymbolId[], position: number): SymbolId {
  return strip[mod(Math.round(position), strip.length)];
}
