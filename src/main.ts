import './style.css';
import { reelPosition, stopPositionWithoutSlip, type SymbolId } from './reel';
import { bitaDeviation, formatFrames, formatMs, type BitaResult } from './judge';
import { alignedLine, nextStreak, stopWithPullIn, type Streak } from './align';
import { pressTime } from './input';
import { loadMachines, msPerSymbol, type Machine, type Row } from './machine';
import { MODES, type Mode, type ModeId } from './modes';
import { ReelView, SYMBOL_LABELS } from './reelView';
import { appendRecord, loadRecords, loadStreaks, saveStreaks, uuid, type TrialRecord } from './records';
import { renderHistory } from './history';

interface Reel {
  view: ReelView;
  canvas: HTMLCanvasElement;
  strip: readonly SymbolId[];
  msPerSymbol: number;
  resultEl: HTMLElement;
  stopButton: HTMLButtonElement;
  /** 回転中なら開始時刻、停止中なら null */
  startTime: number | null;
  /** このゲームで決まった停止位置。未停止なら null */
  stopTarget: number | null;
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
  stopTarget: null,
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

function isSpinning(reel: Reel): boolean {
  return reel.startTime !== null;
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

  streaks.set(mode.id, nextStreak(streaks.get(mode.id)!, success));
  showStreak();
  saveTrial(success, active.map((reel) => reel.deviation!));

  lever.disabled = false;
  setSettingsDisabled(false);
}

function saveTrial(success: boolean, deviations: BitaResult[]): void {
  const average = (f: (d: BitaResult) => number) =>
    deviations.reduce((acc, d) => acc + Math.abs(f(d)), 0) / deviations.length;
  const record: TrialRecord = {
    id: uuid(),
    recordedAt: new Date().toISOString(),
    machineId: machine.id,
    mode: mode.id,
    success,
    framesOff: Math.round(average((d) => d.frames) * 100) / 100,
    msOff: Math.round(average((d) => d.ms) * 10) / 10,
  };
  const saved =
    storage !== null &&
    appendRecord(storage, record) &&
    saveStreaks(storage, Object.fromEntries(streaks));
  saveErrorEl.hidden = saved;
}

function frame(now: number): void {
  for (const reel of reels) {
    if (reel.startTime === null) continue;
    reel.position = reelPosition(now, reel.startTime, reel.msPerSymbol, reel.stopTarget);
    if (reel.stopTarget !== null && reel.position >= reel.stopTarget) {
      reel.startTime = null;
    }
  }
  drawAll();

  if (reels.some(isSpinning)) {
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
    reel.stopTarget = null;
    reel.deviation = null;
    reel.highlight = null;
  }
  for (const i of mode.activeReels) {
    const reel = reels[i];
    // 前回の停止位置から回し始める
    reel.startTime = t - reel.position * reel.msPerSymbol;
    reel.stopButton.disabled = false;
  }
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
    const pressPosition = reelPosition(t, reel.startTime, reel.msPerSymbol);
    const base = stopPositionWithoutSlip(pressPosition);
    reel.stopButton.disabled = true;
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

setMachine(machine);
setMode(mode);
