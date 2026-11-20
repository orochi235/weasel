import { useId } from 'react';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import type { AuditRound } from './skulkMap.types';
import s from './RoundsChart.module.css';

const W = 272, H = 150;
const PENDING_LABEL = { live: 'live', unmerged: 'unmerged' } as const;
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
  const hatch = useId();
  return (
    <SidebarPanel title="Rounds">
      {rounds.length > 0 && (
        <svg className={s.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Defects found and estimated per round">
          <defs>
            <pattern id={hatch} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line className={s.hatch} x1="0" y1="0" x2="0" y2="4" />
            </pattern>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line className={s.grid} x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
              <text className={s.axis} x={M.left - 4} y={y(t) + 3} textAnchor="end">{t}</text>
            </g>
          ))}
          {rounds.map((r, i) => (
            <g key={r.round}>
              <rect className={s.est} x={x(i)} width={bar} y={y(r.est)} height={y(0) - y(r.est)} />
              <rect className={r.pending ? s.pending : s.found} x={x(i)} width={bar} y={y(r.distinct)} height={y(0) - y(r.distinct)}
                fill={r.pending ? `url(#${hatch})` : undefined}>
                <title>{`round ${r.round}${r.pending ? ` (${PENDING_LABEL[r.pending]})` : ''}: ${r.distinct} found, ${r.est} estimated, ${r.areas} areas`}</title>
              </rect>
              {r.pending && <text className={s.tag} x={x(i) + bar / 2} y={Math.max(M.top + 6, y(Math.max(r.est, r.distinct)) - 3)} textAnchor="middle">{PENDING_LABEL[r.pending]}</text>}
              <text className={s.axis} x={x(i) + bar / 2} y={H - 8} textAnchor="middle">{r.round}</text>
            </g>
          ))}
        </svg>
      )}
      <p className={s.hint}>
        Solid: distinct defects found. Dashed: Chapman&apos;s estimate of what those areas held. Hatched: a round not merged
        yet, or still running, read from its run&apos;s own results.
      </p>
    </SidebarPanel>
  );
}
