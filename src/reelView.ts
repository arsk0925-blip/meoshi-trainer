// リール1本ぶんの canvas 描画
import { mod, type SymbolId } from './reel';
import type { Row } from './machine';
import { drawSymbol } from './symbols';

// 選択肢などの文字表示用
export const SYMBOL_LABELS: Record<SymbolId, { text: string }> = {
  '7': { text: '7' },
  BAR: { text: 'BAR' },
  cherry: { text: 'チェリー' },
  grape: { text: 'ブドウ' },
  bell: { text: 'ベル' },
  clown: { text: 'ピエロ' },
  replay: { text: 'リプレイ' },
};

const VISIBLE_ROWS = 3;
const ROW_INDEX: Record<Row, number> = { top: 0, middle: 1, bottom: 2 };

export class ReelView {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    // 枠線を除いた描画領域の大きさに合わせる
    this.canvas.width = Math.round(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** highlight: 揃ったときに光らせる段 */
  draw(strip: readonly SymbolId[], position: number, highlight: Row | null = null): void {
    const { ctx } = this;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return; // 非表示中
    const cellHeight = height / VISIBLE_ROWS;
    const centerTop = cellHeight; // 中段の上端

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#d9d9d9');
    gradient.addColorStop(0.5, '#ffffff');
    gradient.addColorStop(1, '#d9d9d9');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (highlight !== null) {
      ctx.fillStyle = 'rgba(255, 213, 79, 0.55)';
      ctx.fillRect(0, ROW_INDEX[highlight] * cellHeight, width, cellHeight);
    }

    const size = Math.min(width * 0.8, cellHeight * 0.85);
    const base = Math.floor(position);
    for (let k = base - 2; k <= base + 2; k++) {
      // k が大きいほど上にある。position が増えると下へ流れる
      const top = centerTop - (k - position) * cellHeight;
      if (top > height || top + cellHeight < 0) continue;
      drawSymbol(ctx, strip[mod(k, strip.length)], width / 2, top + cellHeight / 2, size);
    }

    // 中段の目安線
    ctx.strokeStyle = 'rgba(229, 57, 53, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, centerTop);
    ctx.lineTo(width, centerTop);
    ctx.moveTo(0, centerTop + cellHeight);
    ctx.lineTo(width, centerTop + cellHeight);
    ctx.stroke();
  }
}
