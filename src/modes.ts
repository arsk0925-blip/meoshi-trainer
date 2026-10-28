// 練習モードの定義
import type { Goal } from './align';

export type ModeId = 'bita' | 'big' | 'reg' | 'cherry';

export interface Mode {
  id: ModeId;
  name: string;
  /** 揃え練習で揃えたい図柄。ビタ押し計測は null（狙い図柄を画面で選ぶ） */
  goal: Goal | null;
  /** 回すリール */
  activeReels: number[];
  /** モードの説明（画面に表示） */
  hint: string;
}

export const MODES: Mode[] = [
  {
    id: 'bita',
    name: 'ビタ押し',
    goal: null,
    activeReels: [0, 1, 2],
    hint: '引き込みなし。狙った図柄から何コマ・何msずれたかを測ります',
  },
  {
    id: 'big',
    name: 'BIG揃え',
    goal: ['7', '7', '7'],
    activeReels: [0, 1, 2],
    hint: '実機のボーナス成立時と同じく、最大4コマ引き込みます（アシストあり）',
  },
  {
    id: 'reg',
    name: 'REG揃え',
    goal: ['7', '7', 'BAR'],
    activeReels: [0, 1, 2],
    hint: '実機のボーナス成立時と同じく、最大4コマ引き込みます（アシストあり）',
  },
  {
    id: 'cherry',
    name: 'チェリー狙い',
    goal: ['cherry', null, null],
    activeReels: [0],
    hint: '左リールだけ回します。最大4コマ引き込みます（アシストあり）',
  },
];
