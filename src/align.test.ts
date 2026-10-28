import { describe, expect, it } from 'vitest';
import { alignedLine, isTenpai, nextStreak, stopWithPullIn, symbolInRow, type Goal } from './align';
import { loadMachines } from './machine';

// 機種A（配列表の番号 − 1 = 添字）
// 左: 7 = 9,19 / BAR = 3,14 / チェリー = 4,13
// 中: 7 = 19
// 右: 7 = 19 / BAR = 18
const machine = loadMachines().find((m) => m.id === 'machine-a')!;
const strips = machine.reels;
const lines = machine.lines;
const BIG: Goal = ['7', '7', '7'];
const REG: Goal = ['7', '7', 'BAR'];
const CHERRY: Goal = ['cherry', null, null];

describe('symbolInRow', () => {
  it('上段は番号が1つ大きい図柄、下段は1つ小さい図柄', () => {
    expect(symbolInRow(strips[0], 9, 'middle')).toBe('7');
    expect(symbolInRow(strips[0], 9, 'top')).toBe('grape'); // 11番
    expect(symbolInRow(strips[0], 9, 'bottom')).toBe('clown'); // 9番
    expect(symbolInRow(strips[0], 0, 'bottom')).toBe('bell'); // 21番に回り込む
  });
});

describe('stopWithPullIn', () => {
  const none = [null, null, null];

  it('4コマ以内なら最小のスベリで引き込む', () => {
    // 左 base=5: 上段に7が来る stop=8（3コマ）が、中段の stop=9（4コマ）より近い
    expect(stopWithPullIn(strips, none, 0, 5, BIG, lines)).toBe(8);
    expect(stopWithPullIn(strips, none, 0, 4, BIG, lines)).toBe(8);
  });

  it('5コマ以上離れていたら引き込まない', () => {
    expect(stopWithPullIn(strips, none, 0, 3, BIG, lines)).toBe(3);
  });

  it('止まっているリールと揃うラインにだけ引き込む', () => {
    const leftTop7 = [8, null, null]; // 左の上段に7
    // 中: 上段(stop=18) か 中段(stop=19) なら揃う可能性がある
    expect(stopWithPullIn(strips, leftTop7, 1, 15, BIG, lines)).toBe(18);
    expect(stopWithPullIn(strips, leftTop7, 1, 19, BIG, lines)).toBe(19);
    // 下段に7を止めても揃うラインがない → 引き込まない
    expect(stopWithPullIn(strips, leftTop7, 1, 20, BIG, lines)).toBe(20);
  });

  it('問わないリールはスベらせない', () => {
    expect(stopWithPullIn(strips, none, 1, 10, CHERRY, lines)).toBe(10);
  });
});

describe('alignedLine', () => {
  it('BIG: 中段に 7-7-7', () => {
    expect(alignedLine(strips, [9, 19, 19], BIG, lines)).toBe(0);
  });

  it('BIG: ライン上に揃っていなければハズレ', () => {
    expect(alignedLine(strips, [9, 19, 18], BIG, lines)).toBe(-1);
  });

  it('BIG: 斜めに揃う', () => {
    // 左上段(stop=8)・中中段(stop=19)・右下段(stop=20)
    expect(alignedLine(strips, [8, 19, 20], BIG, lines)).toBe(3);
  });

  it('REG: 7-7-BAR', () => {
    expect(alignedLine(strips, [9, 19, 18], REG, lines)).toBe(0);
    expect(alignedLine(strips, [9, 19, 19], REG, lines)).toBe(-1);
  });

  it('止まっていないリールがあれば判定しない', () => {
    expect(alignedLine(strips, [9, 19, null], BIG, lines)).toBe(-1);
  });

  it('チェリー: 左リールだけで、どの段でも成功', () => {
    expect(alignedLine(strips, [4, null, null], CHERRY, lines)).toBe(0);
    expect(alignedLine(strips, [3, null, null], CHERRY, lines)).toBe(1);
    expect(alignedLine(strips, [5, null, null], CHERRY, lines)).toBe(2);
    expect(alignedLine(strips, [6, null, null], CHERRY, lines)).toBe(-1);
  });
});

describe('isTenpai', () => {
  it('2本止まって、残り1本で揃うラインがあればテンパイ', () => {
    expect(isTenpai(strips, [9, 19, null], BIG, lines)).toBe(true); // 中段 7-7
    expect(isTenpai(strips, [8, 19, null], BIG, lines)).toBe(true); // 左上段・中中段（右下がり）
    expect(isTenpai(strips, [null, 19, 19], BIG, lines)).toBe(true); // 中・右が先に止まっても同じ
  });

  it('揃うラインがない・まだ1本しか止まっていない・全部止まった場合はテンパイではない', () => {
    expect(isTenpai(strips, [9, 18, null], BIG, lines)).toBe(false);
    expect(isTenpai(strips, [9, null, null], BIG, lines)).toBe(false);
    expect(isTenpai(strips, [9, 19, 19], BIG, lines)).toBe(false);
  });

  it('チェリー狙い（左リールだけ）はテンパイがない', () => {
    expect(isTenpai(strips, [null, null, null], CHERRY, lines)).toBe(false);
  });
});

describe('nextStreak', () => {
  it('成功で+1、失敗で0に戻り、最高記録は残る', () => {
    let s = { current: 0, best: 0 };
    s = nextStreak(s, true);
    s = nextStreak(s, true);
    expect(s).toEqual({ current: 2, best: 2 });
    s = nextStreak(s, false);
    expect(s).toEqual({ current: 0, best: 2 });
    s = nextStreak(s, true);
    expect(s).toEqual({ current: 1, best: 2 });
  });
});
