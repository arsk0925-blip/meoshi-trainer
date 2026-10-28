// リールの位置計算・停止判定（描画から分離した純粋関数）
//
// 位置 position は「図柄何コマぶん進んだか」を表す連続値。
// 中段に来ている図柄は strip[mod(position)]。position が増えるほど次の図柄が上から降りてくる。

export type SymbolId = '7' | 'BAR' | 'cherry' | 'grape' | 'bell' | 'clown' | 'replay';

// 浮動小数の誤差で「ちょうど整数」が次のコマに繰り上がらないようにする
const EPSILON = 1e-9;

/** スタートから最高速に達するまでの時間(ms)。この間は停止ボタンを受け付けない（実機と同じ） */
export const ACCEL_MS = 300;

/** 停止時の揺れ */
const BOUNCE_MS = 140;
const BOUNCE_AMPLITUDE = 0.07; // コマ
const BOUNCE_PERIOD_MS = 70;

export function mod(n: number, length: number): number {
  return ((n % length) + length) % length;
}

/**
 * スタートから elapsed ms で進んだコマ数。
 * accelMs の間は等加速度で加速し、その後は一定速度（1コマ msPerSymbol）で回る。
 */
export function distanceAt(elapsed: number, msPerSymbol: number, accelMs = ACCEL_MS): number {
  if (elapsed <= 0) return 0;
  if (elapsed < accelMs) return (elapsed * elapsed) / (2 * accelMs * msPerSymbol);
  return (elapsed - accelMs / 2) / msPerSymbol;
}

/** distanceAt の逆関数: distance コマ進むのにかかる時間(ms) */
export function timeForDistance(distance: number, msPerSymbol: number, accelMs = ACCEL_MS): number {
  if (distance <= 0) return 0;
  const accelDistance = accelMs / (2 * msPerSymbol);
  if (distance < accelDistance) return Math.sqrt(2 * accelMs * msPerSymbol * distance);
  return distance * msPerSymbol + accelMs / 2;
}

/** 最高速に達していて、停止ボタンを受け付けるか */
export function canStop(now: number, startTime: number, accelMs = ACCEL_MS): boolean {
  return now - startTime >= accelMs;
}

/**
 * 時刻 now におけるリール位置。
 * startPosition から回り始め、stopTarget が決まっていれば、そこに達した時点で止まる。
 */
export function reelPosition(
  now: number,
  startTime: number,
  msPerSymbol: number,
  stopTarget: number | null = null,
  startPosition = 0,
  accelMs = ACCEL_MS,
): number {
  const position = startPosition + distanceAt(now - startTime, msPerSymbol, accelMs);
  return stopTarget === null ? position : Math.min(position, stopTarget);
}

/** stopTarget に到達する時刻 */
export function stopTime(
  startTime: number,
  msPerSymbol: number,
  stopTarget: number,
  startPosition = 0,
  accelMs = ACCEL_MS,
): number {
  return startTime + timeForDistance(stopTarget - startPosition, msPerSymbol, accelMs);
}

/**
 * 停止直後の揺れ（見た目だけ。判定には使わない）。
 * 止まった瞬間から sinceStop ms 経過時の位置のずれ（コマ）を返す。減衰しながら揺れて 0 に戻る
 */
export function bounceOffset(sinceStop: number): number {
  if (sinceStop <= 0 || sinceStop >= BOUNCE_MS) return 0;
  const decay = Math.exp(-sinceStop / (BOUNCE_MS / 3));
  return BOUNCE_AMPLITUDE * decay * Math.sin((2 * Math.PI * sinceStop) / BOUNCE_PERIOD_MS);
}

/**
 * 停止が決まった時点で、表示がすでに停止位置を通り過ぎていた場合の戻り（見た目だけ）。
 * タイミング調整で表示を先回りさせていると起きる。
 * overshoot コマぶん先から、sinceDecision ms かけて停止位置へ滑らかに戻す（停止位置からのずれを返す）
 */
export const REWIND_MS = 90;

export function rewindOffset(overshoot: number, sinceDecision: number): number {
  if (overshoot <= 0 || sinceDecision >= REWIND_MS) return 0;
  const remaining = 1 - Math.max(0, sinceDecision) / REWIND_MS;
  return overshoot * remaining * remaining; // ease-out
}

export function isBouncing(sinceStop: number): boolean {
  return sinceStop >= 0 && sinceStop < BOUNCE_MS;
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
