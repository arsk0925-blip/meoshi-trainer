// 自作の簡易図柄（canvas の図形だけで描く。実機の図柄画像は使わない／似せない）
import type { SymbolId } from './reel';

type Ctx = CanvasRenderingContext2D;

/** (cx, cy) を中心に、1辺 size の正方形に収まるよう図柄を描く */
export function drawSymbol(ctx: Ctx, id: SymbolId, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100); // 以降は -50〜50 の座標系で描く
  DRAWERS[id](ctx);
  ctx.restore();
}

const DRAWERS: Record<SymbolId, (ctx: Ctx) => void> = {
  '7': (ctx) => {
    ctx.font = 'bold 92px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#7f0000';
    ctx.strokeText('7', 0, 6);
    ctx.fillStyle = '#e53935';
    ctx.fillText('7', 0, 6);
  },

  BAR: (ctx) => {
    ctx.fillStyle = '#212121';
    roundRect(ctx, -46, -20, 92, 40, 10);
    ctx.fill();
    ctx.font = 'bold 30px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BAR', 0, 2);
  },

  cherry: (ctx) => {
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 12);
    ctx.quadraticCurveTo(-8, -20, 10, -38);
    ctx.moveTo(20, 16);
    ctx.quadraticCurveTo(18, -14, 10, -38);
    ctx.stroke();
    for (const [x, y] of [[-20, 20], [20, 22]]) {
      ctx.fillStyle = '#d32f2f';
      circle(ctx, x, y, 18);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      circle(ctx, x - 6, y - 6, 5);
      ctx.fill();
    }
  },

  grape: (ctx) => {
    ctx.fillStyle = '#43a047';
    ctx.beginPath();
    ctx.ellipse(14, -36, 14, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    const rows = [[-24, -12, 0, 12, 24], [-18, -6, 6, 18], [-12, 0, 12], [-6, 6], [0]];
    rows.forEach((xs, row) => {
      for (const x of xs) {
        ctx.fillStyle = '#7b1fa2';
        circle(ctx, x, -24 + row * 13, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        circle(ctx, x - 3, -27 + row * 13, 2.5);
        ctx.fill();
      }
    });
  },

  bell: (ctx) => {
    ctx.fillStyle = '#fbc02d';
    ctx.strokeStyle = '#a17800';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-34, 22);
    ctx.quadraticCurveTo(-28, 14, -26, -6);
    ctx.quadraticCurveTo(-24, -34, 0, -36);
    ctx.quadraticCurveTo(24, -34, 26, -6);
    ctx.quadraticCurveTo(28, 14, 34, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a17800';
    circle(ctx, 0, 28, 7);
    ctx.fill();
    circle(ctx, 0, -40, 5);
    ctx.fill();
  },

  clown: (ctx) => {
    // 帽子
    ctx.fillStyle = '#3949ab';
    ctx.beginPath();
    ctx.moveTo(-22, -16);
    ctx.lineTo(0, -48);
    ctx.lineTo(22, -16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fdd835';
    circle(ctx, 0, -48, 6);
    ctx.fill();
    // 顔
    ctx.fillStyle = '#fff3e0';
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 2;
    circle(ctx, 0, 8, 28);
    ctx.fill();
    ctx.stroke();
    // 目・鼻・口
    ctx.fillStyle = '#263238';
    circle(ctx, -10, 0, 3.5);
    ctx.fill();
    circle(ctx, 10, 0, 3.5);
    ctx.fill();
    ctx.fillStyle = '#e53935';
    circle(ctx, 0, 10, 6);
    ctx.fill();
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 16, 12, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  },

  replay: (ctx) => {
    // 回転矢印
    ctx.strokeStyle = '#1e88e5';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 2, 28, -0.35 * Math.PI, 1.35 * Math.PI);
    ctx.stroke();
    const angle = -0.35 * Math.PI;
    const tipX = Math.cos(angle) * 28;
    const tipY = 2 + Math.sin(angle) * 28;
    ctx.fillStyle = '#1e88e5';
    ctx.beginPath();
    ctx.moveTo(tipX + 14, tipY + 10);
    ctx.lineTo(tipX - 6, tipY - 16);
    ctx.lineTo(tipX - 14, tipY + 14);
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
