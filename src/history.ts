// 履歴画面の描画
import { MODES } from './modes';
import { dailyByMode, summaryByMode, type Streaks, type Summary, type TrialRecord } from './records';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function rate(summary: Summary): string {
  if (summary.trials === 0) return '—';
  return `${Math.round((summary.successes / summary.trials) * 100)}%`;
}

export function renderHistory(container: HTMLElement, records: readonly TrialRecord[], streaks: Streaks): void {
  container.replaceChildren();
  for (const mode of MODES) {
    const summary = summaryByMode(records, mode.id);
    const card = el('div', 'history-card');
    card.append(el('h2', undefined, mode.name));

    const stats = el('dl', 'history-stats');
    const add = (label: string, value: string) => stats.append(el('dt', undefined, label), el('dd', undefined, value));
    add('成功率', `${rate(summary)}（${summary.successes}/${summary.trials}回）`);
    add('平均ずれ', summary.trials ? `${summary.framesOff.toFixed(1)}コマ / ${Math.round(summary.msOff)}ms` : '—');
    add('最高連続成功', `${streaks[mode.id]?.best ?? 0}回`);
    card.append(stats);

    const daily = dailyByMode(records, mode.id);
    if (daily.length > 0) {
      const table = el('table', 'history-daily');
      const head = el('tr');
      head.append(el('th', undefined, '日付'), el('th', undefined, '成功率'), el('th', undefined, '回数'));
      table.append(head);
      for (const { date, summary: day } of daily) {
        const row = el('tr');
        row.append(el('td', undefined, date), el('td', undefined, rate(day)), el('td', undefined, `${day.trials}`));
        table.append(row);
      }
      card.append(table);
    }
    container.append(card);
  }
}
