import './style.css';
import {
  bounceOffset,
  canStop,
  isBouncing,
  reelPosition,
  REWIND_MS,
  rewindOffset,
  stopPositionWithoutSlip,
  stopTime,
  type SymbolId,
} from './reel';
import { bitaDeviation, formatFrames, formatMs, type BitaResult } from './judge';
import { alignedLine, nextStreak, stopWithPullIn, type Streak } from './align';
import { pressTime } from './input';
import { loadMachines, msPerSymbol, type Machine, type Row } from './machine';
import { MODES, type Mode, type ModeId } from './modes';
import { ReelView, SYMBOL_LABELS } from './reelView';
import { Sound } from './sound';
import {
  DEFAULT_SETTINGS,
  appendRecord,
  loadRecords,
  loadSettings,
  loadStreaks,
  saveSettings,
  saveStreaks,
  uuid,
  type TrialRecord,
} from './records';
import { renderHistory } from './history';
import { clampOffset, formatOffset, OFFSET_STEP, suggestOffset, CALIBRATION_MIN_TRIALS } from './calibration';

interface Reel {
  view: ReelView;
  canvas: HTMLCanvasElement;
  strip: readonly SymbolId[];
  msPerSymbol: number;
  resultEl: HTMLElement;
  stopButton: HTMLButtonElement;
  /** このゲームで回しているなら開始時刻。回していないリールは null */
  startTime: number | null;
  /** 回し始めた位置 */
  startPosition: number;
  /** このゲームで決まった停止位置。未停止なら null */
  stopTarget: number | null;
  /** 止まって揺れも収まったら true */
  done: boolean;
  /** 停止が決まった時刻と、その時点で表示が停止位置を通り過ぎていたコマ数 */
  decidedAt: number;
  overshoot: number;
  /** 表示中の位置（停止時の揺れを含む） */
  position: number;
  /** このゲームの押下のずれ（狙い図柄を中段にスベリなしで止めるタイミング基準） */
  deviation: BitaResult | null;
  /** 揃ったときに光らせる段 */
  highlight: Row | null;
}

const machines = loadMachines();
let machine: Machine = machines[0];
let mode: Mode = MODES[0];
let gameRunning = false;

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const storage = getStorage();

const settings = storage ? loadSettings(storage) : { ...DEFAULT_SETTINGS };
const sound = new Sound(settings.soundEnabled);

const savedStreaks = storage ? loadStreaks(storage) : {};
const streaks = new Map<ModeId, Streak>(
  MODES.map((m) => [m.id, savedStreaks[m.id] ?? { current: 0, best: 0 }]),
);

const machineSelect = document.querySelector<HTMLSelectElement>('#machine')!;
const modeSelect = document.querySelector<HTMLSelectElement>('#mode')!;
const targetField = document.querySelector<HTMLElement>('#target-field')!;
const targetSelect = document.querySelector<HTMLSelectElement>('#target')!;
const verdictEl = document.querySelector<HTMLElement>('#verdict')!;
const streakEl = document.querySelector<HTMLElement>('#streak')!;
const lever = document.querySelector<HTMLButtonElement>('#lever')!;
const saveErrorEl = document.querySelector<HTMLElement>('#save-error')!;
const historyBody = document.querySelector<HTMLElement>('#history-body')!;
const offsetValueEl = document.querySelector<HTMLElement>('#offset-value')!;
const soundToggle = document.querySelector<HTMLButtonElement>('#sound-toggle')!;
const offsetMessageEl = document.querySelector<HTMLElement>('#offset-message')!;
const canvases = document.querySelectorAll<HTMLCanvasElement>('.reel');
const resultEls = document.querySelectorAll<HTMLElement>('.reel-result');
const stopButtons = document.querySelectorAll<HTMLButtonElement>('.stop');

const reels: Reel[] = Array.from(canvases, (canvas, i) => ({
  view: new ReelView(canvas),
  canvas,
  strip: machine.reels[i],
  msPerSymbol: msPerSymbol(machine, i),
  resultEl: resultEls[i],
  stopButton: stopButtons[i],
  startTime: null,
  startPosition: 0,
  stopTarget: null,
  done: true,
  decidedAt: 0,
  overshoot: 0,
  position: 0,
  deviation: null,
  highlight: null,
}));

function addOptions(select: HTMLSelectElement, items: { value: string; label: string }[]): void {
  select.replaceChildren(
    ...items.map(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
}

function clearResults(): void {
  for (const reel of reels) {
    reel.resultEl.textContent = '';
    reel.resultEl.className = 'reel-result';
    reel.highlight = null;
  }
  verdictEl.textContent = '';
  verdictEl.className = 'verdict';
}

function showStreak(): void {
  const { current, best } = streaks.get(mode.id)!;
  streakEl.textContent = `連続成功 ${current}回（最高 ${best}回）`;
}

function setMachine(next: Machine): void {
  machine = next;
  reels.forEach((reel, i) => {
    reel.strip = machine.reels[i];
    reel.msPerSymbol = msPerSymbol(machine, i);
    reel.position = 0;
  });

  // 狙い図柄の選択肢: 全リールに存在する図柄
  const previous = targetSelect.value;
  addOptions(
    targetSelect,
    (Object.keys(SYMBOL_LABELS) as SymbolId[])
      .filter((symbol) => reels.every((reel) => reel.strip.includes(symbol)))
      .map((symbol) => ({ value: symbol, label: SYMBOL_LABELS[symbol].text })),
  );
  if ([...targetSelect.options].some((o) => o.value === previous)) targetSelect.value = previous;

  clearResults();
  drawAll();
}

function setMode(next: Mode): void {
  mode = next;
  targetField.hidden = mode.goal !== null;
  reels.forEach((reel, i) => reel.canvas.classList.toggle('inactive', !mode.activeReels.includes(i)));
  clearResults();
  showStreak();
  drawAll();
}

/** リール i で狙う図柄 */
function targetFor(i: number): SymbolId {
  return mode.goal?.[i] ?? (targetSelect.value as SymbolId);
}

function drawAll(): void {
  for (const reel of reels) reel.view.draw(reel.strip, reel.position, reel.highlight);
}

function setSettingsDisabled(disabled: boolean): void {
  machineSelect.disabled = disabled;
  modeSelect.disabled = disabled;
  targetSelect.disabled = disabled;
}

function finishGame(): void {
  gameRunning = false;
  const active = mode.activeReels.map((i) => reels[i]);
  let success: boolean;
  if (mode.goal === null) {
    success = active.every((reel) => reel.deviation?.frames === 0);
    verdictEl.textContent = success ? '全リール ビタ！' : 'ハズレ';
  } else {
    const stops = reels.map((reel, i) => (mode.activeReels.includes(i) ? reel.stopTarget : null));
    const line = alignedLine(machine.reels, stops, mode.goal, machine.lines);
    success = line >= 0;
    if (success) {
      mode.activeReels.forEach((i) => (reels[i].highlight = machine.lines[line][i]));
      drawAll();
    }
    verdictEl.textContent = success ? '揃った！' : 'ハズレ';
  }
  verdictEl.className = `verdict ${success ? 'hit' : 'miss'}`;
  if (success) sound.win(mode.id);

  streaks.set(mode.id, nextStreak(streaks.get(mode.id)!, success));
  showStreak();
  saveTrial(success, active.map((reel) => reel.deviation!));

  lever.disabled = false;
  setSettingsDisabled(false);
}

function saveTrial(success: boolean, deviations: BitaResult[]): void {
  const average = (f: (d: BitaResult) => number) =>
    deviations.reduce((acc, d) => acc + Math.abs(f(d)), 0) / deviations.length;
  const bias = deviations.reduce((acc, d) => acc + d.ms, 0) / deviations.length;
  const record: TrialRecord = {
    id: uuid(),
    recordedAt: new Date().toISOString(),
    machineId: machine.id,
    mode: mode.id,
    success,
    framesOff: Math.round(average((d) => d.frames) * 100) / 100,
    msOff: Math.round(average((d) => d.ms) * 10) / 10,
    msBias: Math.round(bias * 10) / 10,
    timingOffsetMs: settings.timingOffsetMs,
  };
  const saved =
    storage !== null &&
    appendRecord(storage, record) &&
    saveStreaks(storage, Object.fromEntries(streaks));
  saveErrorEl.hidden = saved;
}

function frame(now: number): void {
  // タイミング調整: 表示を調整値ぶん先回りさせて、画面表示・タップ検出の遅れを打ち消す。
  // 停止位置の判定は実際のタップ時刻で行う
  const displayTime = now + settings.timingOffsetMs;
  for (const reel of reels) {
    if (reel.startTime === null || reel.done) continue;
    if (reel.stopTarget === null) {
      // 最高速に達したら停止ボタンを受け付ける
      reel.stopButton.disabled = !canStop(now, reel.startTime);
      reel.position = reelPosition(displayTime, reel.startTime, reel.msPerSymbol, null, reel.startPosition);
      continue;
    }
    const stoppedAt = stopTime(reel.startTime, reel.msPerSymbol, reel.stopTarget, reel.startPosition);
    const sinceStop = displayTime - stoppedAt;
    const sinceDecision = now - reel.decidedAt;
    if (sinceStop < 0) {
      reel.position = reelPosition(displayTime, reel.startTime, reel.msPerSymbol, reel.stopTarget, reel.startPosition);
    } else if (reel.overshoot > 0 && sinceDecision < REWIND_MS) {
      reel.position = reel.stopTarget + rewindOffset(reel.overshoot, sinceDecision);
    } else if (isBouncing(sinceStop)) {
      reel.position = reel.stopTarget + bounceOffset(sinceStop);
    } else {
      reel.position = reel.stopTarget;
      reel.done = true;
    }
  }
  drawAll();

  if (reels.some((reel) => reel.startTime !== null && !reel.done)) {
    requestAnimationFrame(frame);
  } else if (gameRunning) {
    finishGame();
  }
}

lever.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (gameRunning) return;
  const t = pressTime(event.timeStamp, performance.now());
  clearResults();
  for (const reel of reels) {
    reel.startTime = null;
    reel.stopTarget = null;
    reel.done = true;
    reel.deviation = null;
    reel.highlight = null;
  }
  for (const i of mode.activeReels) {
    const reel = reels[i];
    // 前回の停止位置から回し始める
    reel.startTime = t;
    reel.startPosition = Math.round(reel.position);
    reel.done = false;
    reel.stopButton.disabled = true; // 最高速に達するまで押せない
  }
  sound.unlock();
  sound.lever();
  sound.startSpin();
  gameRunning = true;
  lever.disabled = true;
  setSettingsDisabled(true);
  requestAnimationFrame(frame);
});

reels.forEach((reel, i) => {
  reel.stopButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (reel.startTime === null || reel.stopTarget !== null) return;
    const t = pressTime(event.timeStamp, performance.now());
    if (!canStop(t, reel.startTime)) return;
    const pressPosition = reelPosition(t, reel.startTime, reel.msPerSymbol, null, reel.startPosition);
    const base = stopPositionWithoutSlip(pressPosition);
    reel.stopButton.disabled = true;
    reel.decidedAt = performance.now();
    reel.deviation = bitaDeviation(reel.strip, targetFor(i), pressPosition, reel.msPerSymbol);

    if (mode.goal === null) {
      reel.stopTarget = base;
      reel.resultEl.textContent = `${formatFrames(reel.deviation.frames)}\n${formatMs(reel.deviation.ms)}`;
      reel.resultEl.classList.add(reel.deviation.frames === 0 ? 'hit' : 'miss');
    } else {
      const stops = reels.map((r) => r.stopTarget);
      reel.stopTarget = stopWithPullIn(machine.reels, stops, i, base, mode.goal, machine.lines);
      const slip = reel.stopTarget - base;
      reel.resultEl.textContent = slip > 0 ? `スベリ${slip}コマ` : 'スベリなし';
    }
    // 表示を先回りさせていると、表示がすでに停止位置を過ぎていることがある
    reel.overshoot = reel.position - reel.stopTarget;

    // 画面上でリールが止まる時刻に停止音を鳴らす
    const stoppedAt = stopTime(reel.startTime, reel.msPerSymbol, reel.stopTarget, reel.startPosition);
    const delay = stoppedAt - settings.timingOffsetMs - performance.now();
    sound.stopClick(delay);
    if (mode.activeReels.every((j) => reels[j].stopTarget !== null)) sound.stopSpin(delay);
  });
});

window.addEventListener('resize', () => {
  for (const reel of reels) reel.view.resize();
  drawAll();
});

addOptions(machineSelect, machines.map((m) => ({ value: m.id, label: m.name })));
machineSelect.addEventListener('change', () => {
  setMachine(machines.find((m) => m.id === machineSelect.value)!);
});
addOptions(modeSelect, MODES.map((m) => ({ value: m.id, label: m.name })));
modeSelect.addEventListener('change', () => {
  setMode(MODES.find((m) => m.id === modeSelect.value)!);
});

for (const tab of document.querySelectorAll<HTMLButtonElement>('.tab')) {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view!;
    for (const t of document.querySelectorAll<HTMLElement>('.tab')) t.classList.toggle('active', t === tab);
    for (const v of document.querySelectorAll<HTMLElement>('.view')) v.hidden = v.id !== view;
    if (view === 'history') {
      renderHistory(historyBody, storage ? loadRecords(storage) : [], Object.fromEntries(streaks));
    } else {
      // 非表示の間は canvas の大きさが 0 になるので測り直す
      for (const reel of reels) reel.view.resize();
      drawAll();
    }
  });
}

function saveSettingsToStorage(): void {
  if (storage) saveSettings(storage, settings);
}

function showSound(): void {
  soundToggle.textContent = settings.soundEnabled ? '音 ON' : '音 OFF';
  soundToggle.classList.toggle('off', !settings.soundEnabled);
}

soundToggle.addEventListener('click', () => {
  settings.soundEnabled = !settings.soundEnabled;
  sound.setEnabled(settings.soundEnabled);
  sound.unlock();
  saveSettingsToStorage();
  showSound();
});

function showOffset(): void {
  offsetValueEl.textContent = formatOffset(settings.timingOffsetMs);
}

function setOffset(offsetMs: number): void {
  settings.timingOffsetMs = clampOffset(offsetMs);
  saveSettingsToStorage();
  showOffset();
}

document.querySelector('#offset-minus')!.addEventListener('click', () => {
  setOffset(settings.timingOffsetMs - OFFSET_STEP);
  offsetMessageEl.textContent = '';
});
document.querySelector('#offset-plus')!.addEventListener('click', () => {
  setOffset(settings.timingOffsetMs + OFFSET_STEP);
  offsetMessageEl.textContent = '';
});
document.querySelector('#offset-auto')!.addEventListener('click', () => {
  const suggestion = suggestOffset(storage ? loadRecords(storage) : []);
  if (suggestion === null) {
    offsetMessageEl.textContent = `ビタ押しモードで${CALIBRATION_MIN_TRIALS}回以上プレイすると自動調整できます`;
    return;
  }
  setOffset(suggestion.offsetMs);
  offsetMessageEl.textContent = `直近${suggestion.trials}回のビタ押しから「${formatOffset(settings.timingOffsetMs)}」に設定しました`;
});

showSound();
showOffset();
setMachine(machine);
setMode(mode);
