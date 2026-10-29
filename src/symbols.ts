// 自作の図柄（canvas の図形だけで描く。実機の絵をトレース・模写しない）
// 目押しの目印になる特徴（色・大きさ・大まかな形）だけを実機に寄せている（requirements.md 参照）
import type { SymbolId } from './reel';

type Ctx = CanvasRenderingContext2D;

/**
 * (cx, cy) を中心に、幅 width・高さ height のコマに図柄を描く。
 * 図柄は高さ 100（-50〜50）の座標系で描き、横は ±halfWidth まで使える
 */
export function drawSymbol(ctx: Ctx, id: SymbolId, cx: number, cy: number, width: number, height: number): void {
  const scale = height / 100;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  DRAWERS[id](ctx, width / 2 / scale);
  ctx.restore();
}

const DRAWERS: Record<SymbolId, (ctx: Ctx, halfWidth: number) => void> = {
  // 横幅いっぱいの太い赤い7
  '7': (ctx, halfWidth) => {
    const w = Math.min(halfWidth * 0.92, 80);
    ctx.save();
    ctx.scale(w / 50, 1);
    ctx.beginPath();
    ctx.moveTo(-48, -41);
    ctx.lineTo(49, -41);
    ctx.lineTo(49, -16);
    ctx.lineTo(16, 42);
    ctx.lineTo(-27, 42);
    ctx.lineTo(3, -8);
    ctx.lineTo(-42, -8);
    ctx.closePath();
    ctx.restore();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#6d0000';
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#e8202a';
    ctx.fill();
  },

  // 黒い2段の BAR
  BAR: (ctx, halfWidth) => {
    const w = Math.min(halfWidth * 0.92, 80);
    ctx.font = 'bold 22px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const y of [-19, 19]) {
      ctx.fillStyle = '#151515';
      roundRect(ctx, -w, y - 16, w * 2, 32, 16);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText('BAR', 0, y + 1);
    }
  },

  // 赤い2粒と緑の葉
  cherry: (ctx) => {
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.ellipse(22, -34, 16, 8, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#33691e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 14);
    ctx.quadraticCurveTo(-10, -18, 8, -36);
    ctx.moveTo(18, 16);
    ctx.quadraticCurveTo(16, -12, 8, -36);
    ctx.stroke();
    for (const [x, y] of [[-20, 22], [19, 24]]) {
      ctx.fillStyle = '#d50000';
      circle(ctx, x, y, 19);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      circle(ctx, x - 7, y - 7, 5);
      ctx.fill();
    }
  },

  // 緑の房
  grape: (ctx) => {
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.ellipse(18, -38, 16, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    const rows = [[-26, -13, 0, 13, 26], [-19, -6, 7, 20], [-13, 0, 13], [-6, 7], [0]];
    rows.forEach((xs, row) => {
      for (const x of xs) {
        ctx.fillStyle = '#7cb342';
        circle(ctx, x, -26 + row * 14, 8.5);
        ctx.fill();
        ctx.strokeStyle = '#33691e';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        circle(ctx, x - 3, -29 + row * 14, 2.5);
        ctx.fill();
      }
    });
  },

  // 黄色いベル
  bell: (ctx) => {
    ctx.fillStyle = '#ffca28';
    ctx.strokeStyle = '#9a6b00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-38, 24);
    ctx.quadraticCurveTo(-30, 16, -28, -6);
    ctx.quadraticCurveTo(-26, -36, 0, -38);
    ctx.quadraticCurveTo(26, -36, 28, -6);
    ctx.quadraticCurveTo(30, 16, 38, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-12, -14, 5, 14, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9a6b00';
    circle(ctx, 0, 31, 7);
    ctx.fill();
  },

  // 白い顔と帽子
  clown: (ctx) => {
    // 帽子（単色のシルクハット）
    ctx.fillStyle = '#1e3a8a';
    roundRect(ctx, -30, -22, 60, 8, 4);
    ctx.fill();
    ctx.fillRect(-17, -48, 34, 28);
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(-17, -30, 34, 6);
    // 顔
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 2;
    circle(ctx, 0, 10, 26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#263238';
    circle(ctx, -9, 4, 3.5);
    ctx.fill();
    circle(ctx, 9, 4, 3.5);
    ctx.fill();
    ctx.fillStyle = '#e53935';
    circle(ctx, 0, 13, 6);
    ctx.fill();
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 18, 11, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  },

  // オレンジの丸に白い回転矢印
  replay: (ctx) => {
    ctx.fillStyle = '#f57c00';
    ctx.strokeStyle = '#a14d00';
    ctx.lineWidth = 3;
    circle(ctx, 0, 0, 38);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 2, 20, -0.35 * Math.PI, 1.35 * Math.PI);
    ctx.stroke();
    const angle = -0.35 * Math.PI;
    const tipX = Math.cos(angle) * 20;
    const tipY = 2 + Math.sin(angle) * 20;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(tipX + 11, tipY + 8);
    ctx.lineTo(tipX - 5, tipY - 12);
    ctx.lineTo(tipX - 11, tipY + 11);
    ctx.closePath();
    ctx.fill();
  },
};

function circle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
