// 機種データ（src/machines/*.json）の型と読み込み
import type { SymbolId } from './reel';

export type Row = 'top' | 'middle' | 'bottom';

export interface Machine {
  id: string;
  /** 画面表示名。メーカーの商標は使わない */
  name: string;
  /** リール1周の時間(ms) */
  msPerRevolution: number;
  /** 有効ライン。各ラインは [左, 中, 右] リールの段 */
  lines: [Row, Row, Row][];
  /**
   * [左, 中, 右] リールの配列。配列表の番号順（1番 = 配列表の下端）に並べる。
   * リールは下向きに回るので、番号が1つ大きい図柄が次に中段へ来る。
   */
  reels: [SymbolId[], SymbolId[], SymbolId[]];
}

const SYMBOLS: readonly string[] = ['7', 'BAR', 'cherry', 'grape', 'bell', 'clown', 'replay'];
const ROWS: readonly string[] = ['top', 'middle', 'bottom'];

/** JSON の中身を検査して Machine にする。不正ならエラー */
export function parseMachine(data: unknown, source = '機種データ'): Machine {
  const fail = (reason: string): never => {
    throw new Error(`${source}: ${reason}`);
  };
  const m = data as Partial<Machine>;
  if (typeof m?.id !== 'string' || m.id === '') fail('id がありません');
  if (typeof m.name !== 'string' || m.name === '') fail('name がありません');
  if (typeof m.msPerRevolution !== 'number' || !(m.msPerRevolution > 0)) {
    fail('msPerRevolution は正の数にしてください');
  }
  if (!Array.isArray(m.reels) || m.reels.length !== 3) fail('reels はリール3本ぶん必要です');
  m.reels!.forEach((strip, i) => {
    if (!Array.isArray(strip) || strip.length === 0) fail(`reels[${i}] が空です`);
    strip.forEach((s, j) => {
      if (!SYMBOLS.includes(s)) fail(`reels[${i}][${j}] の図柄 "${s}" は使えません`);
    });
  });
  if (!Array.isArray(m.lines) || m.lines.length === 0) fail('lines が空です');
  m.lines!.forEach((line, i) => {
    if (!Array.isArray(line) || line.length !== 3 || !line.every((r) => ROWS.includes(r))) {
      fail(`lines[${i}] は ["top"|"middle"|"bottom"] を3つ並べてください`);
    }
  });
  return m as Machine;
}

export function msPerSymbol(machine: Machine, reelIndex: number): number {
  return machine.msPerRevolution / machine.reels[reelIndex].length;
}

/** src/machines/ に置いた JSON をすべて読み込む（ファイルを足すだけで機種が増える） */
export function loadMachines(): Machine[] {
  const modules = import.meta.glob<unknown>('./machines/*.json', { eager: true, import: 'default' });
  return Object.entries(modules)
    .map(([path, data]) => parseMachine(data, path))
    .sort((a, b) => a.id.localeCompare(b.id));
}
