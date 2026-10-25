// pointerdown の event.timeStamp を performance.now() と同じ時間軸の押下時刻として使う。
// 古いブラウザなどで timeStamp が別の時間軸（エポックms等）だった場合は now にフォールバックする。
const MAX_INPUT_DELAY_MS = 1000;

export function pressTime(eventTimeStamp: number, now: number): number {
  const delay = now - eventTimeStamp;
  if (eventTimeStamp > 0 && delay >= 0 && delay < MAX_INPUT_DELAY_MS) {
    return eventTimeStamp;
  }
  return now;
}
