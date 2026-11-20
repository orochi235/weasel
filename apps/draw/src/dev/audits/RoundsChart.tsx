import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import type { AuditRound } from './skulkMap.types';
import s from './RoundsChart.module.css';

const W = 272, H = 150;
const M = { top: 8, right: 6, bottom: 22, left: 28 };

/** Round ticks for a value axis from 0 to at least `max`: a step of 1, 2 or 5 times a power of ten. */
export function ticksFor(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((st) => st >= rough) ?? 10 * pow;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Each round's distinct defects found, against Chapman's estimate of what its areas held. */
export function RoundsChart({ rounds }: { rounds: readonly AuditRound[] }) {
  const ticks = ticksFor(Math.max(0, ...rounds.map((r) => Math.max(r.est, r.distinct))));
  const top = ticks.at(-1) || 1;
  const y = (v: number) => H - M.bottom - ((H - M.top - M.bottom) * v) / top;
  const band = (W - M.left - M.right) / Math.max(1, rounds.length);
  const bar = band * 0.75;
  const x = (i: number) => M.left + i * band + (band - bar) / 2;
  return (
    <SidebarPanel title="Rounds">
      {rounds.length > 0 && (
        <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Defects found and estimated per round">
          {ticks.map((t) => (
            <g key={t}>
              <line className={s.grid} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
              <text className={s.axis} x={M.left - 4} y={y(t) + 3} textAnchor="end">{t}</text>
            </g>
          ))}
          {rounds.map((r, i) => (
            <g key={r.round}>
              <rect className={s.est} x={x(i)} width={bar} y={y(r.est)} height={y(0) - y(r.est)} />
              <rect className={s.found} x={x(i)} width={bar} y={y(r.distinct)} height={y(0) - y(r.distinct)}>
                <title>{`round ${r.round}: ${r.distinct} found, ${r.est} estimated, ${r.areas} areas`}</title>
              </rect>
              <text className={s.axis} x={x(i) + bar / 2} y={H - 8} textAnchor="middle">{r.round}</text>
            </g>
          ))}
        </svg>
      )}
      <p className={s.hint}>Solid: distinct defects found. Dashed: Chapman&apos;s estimate of what those areas held.</p>
    </SidebarPanel>
  );
}
